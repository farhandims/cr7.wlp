const express = require('express');
const PDFDocument = require('pdfkit');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function formatRp(val) {
  if (!val || val === 0) return 'Rp 0';
  return 'Rp ' + Number(val).toLocaleString('id-ID');
}

// Helper: get active branch info
function getCabangInfo() {
  try {
    return db.prepare('SELECT * FROM master_cabang WHERE is_active = 1 ORDER BY id LIMIT 1').get() || null;
  } catch (e) { return null; }
}

// Determine if item is "Sudah Ganti"
function isSudahGanti(status) {
  const replacedStatuses = ['REPLACED', 'REPLACED_OTHER', 'REPLACED_NONORI', 'CLOSED'];
  return replacedStatuses.includes(status);
}

// GET /api/export/pdf/:vehicleId
router.get('/pdf/:vehicleId', authenticate, (req, res) => {
  try {
    const vehicle = db.prepare('SELECT * FROM kendaraan WHERE id = ?').get(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan.' });

    const headers = db.prepare(`
      SELECT h.*, t.nama_teknisi, s.nama_sa
      FROM service_advice_headers h
      LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      LEFT JOIN master_sa s ON h.sa_id = s.id
      WHERE h.kendaraan_id = ? ORDER BY h.tanggal_input DESC
    `).all(req.params.vehicleId);

    const cabang = getCabangInfo();

    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Summary_${vehicle.no_polisi}_${new Date().toISOString().split('T')[0]}.pdf`);
    doc.pipe(res);

    const pageWidth = 515; // A4 width - 2*40 margin
    const leftMargin = 40;

    // ===== HEADER: Left-aligned =====
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text(cabang ? cabang.nama_cabang : 'WIJAYA TOYOTA', leftMargin, 40);
    if (cabang && cabang.alamat) {
      doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        .text(`${cabang.alamat}${cabang.telepon ? '  |  Telp: ' + cabang.telepon : ''}`, leftMargin);
    }
    doc.fontSize(10).font('Helvetica').fillColor('#64748b')
      .text('Ringkasan Saran Service Kendaraan', leftMargin);
    doc.moveDown(0.6);

    // Separator line
    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).strokeColor('#1e3a5f').lineWidth(1.5).stroke();
    doc.moveDown(0.5);

    // ===== VEHICLE INFO =====
    doc.fontSize(9).fillColor('#333');
    const drawInfoRow = (label, value, y) => {
      doc.font('Helvetica-Bold').text(label, leftMargin, y, { width: 120 });
      doc.font('Helvetica').text(': ' + value, leftMargin + 120, y);
    };
    let infoY = doc.y;
    drawInfoRow('No Polisi', vehicle.no_polisi, infoY);
    drawInfoRow('No Rangka (VIN)', vehicle.no_rangka, infoY + 15);
    drawInfoRow('Model', vehicle.model, infoY + 30);
    drawInfoRow('Total Dokumen', `${headers.length} dokumen`, infoY + 45);
    doc.y = infoY + 65;

    // Separator
    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    // ===== TRACKING TOTALS =====
    let grandSudahPart = 0, grandSudahJasa = 0;
    let grandBelumPart = 0, grandBelumJasa = 0;
    let countSudahPart = 0, countSudahJasa = 0;
    let countBelumPart = 0, countBelumJasa = 0;

    // ===== TABLE COLUMN DEFINITIONS =====
    // Tipe | Kategori | Nama Part/Jasa | Qty | Total Harga | Status
    const colDefs = [
      { label: 'Tipe',           x: 40,  w: 38 },
      { label: 'Kategori',       x: 78,  w: 80 },
      { label: 'Nama Part/Jasa', x: 158, w: 165 },
      { label: 'Qty',            x: 323, w: 30 },
      { label: 'Total Harga',    x: 353, w: 95 },
      { label: 'Status',         x: 448, w: 107 },
    ];
    const tableWidth = pageWidth;
    const rowHeight = 16;

    for (const h of headers) {
      const items = db.prepare(`
        SELECT i.*, mk.nama_kategori
        FROM service_advice_items i
        LEFT JOIN master_kategori_service mk ON i.kategori_id = mk.id
        WHERE i.header_id = ?
        ORDER BY i.item_type, i.id
      `).all(h.id);

      if (items.length === 0) continue;

      // Estimate space needed: header(30) + table header(18) + items + gap
      const neededSpace = 30 + 18 + (items.length * rowHeight) + 20;
      if (doc.y + Math.min(neededSpace, 100) > 750) doc.addPage();

      // ===== DOCUMENT SUB-HEADER =====
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f')
        .text(h.nomor_dokumen, leftMargin);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        .text(`Tanggal: ${(h.tanggal_input || '').split(' ')[0]}`);
      doc.moveDown(0.3);

      // ===== TABLE HEADER =====
      const tableTop = doc.y;
      doc.rect(leftMargin, tableTop, tableWidth, 18).fill('#1e3a5f');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff');
      colDefs.forEach(col => {
        const align = col.label === 'Total Harga' ? 'right' : 'left';
        doc.text(col.label, col.x + 3, tableTop + 5, { width: col.w - 6, align });
      });

      let rowY = tableTop + 18;

      // ===== TABLE ROWS =====
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const harga = item.item_type === 'PART'
          ? (item.harga_part || 0) * (item.qty || 1)
          : (item.harga_jasa || 0);

        const sudah = isSudahGanti(item.item_status);
        const statusLabel = sudah ? 'Sudah Ganti' : 'Belum Ganti';

        // Track totals
        if (item.item_type === 'PART') {
          if (sudah) { grandSudahPart += harga; countSudahPart++; }
          else { grandBelumPart += harga; countBelumPart++; }
        } else {
          if (sudah) { grandSudahJasa += harga; countSudahJasa++; }
          else { grandBelumJasa += harga; countBelumJasa++; }
        }

        // Check page break
        if (rowY > 760) {
          doc.addPage();
          rowY = 40;
          // Re-draw table header on new page
          doc.rect(leftMargin, rowY, tableWidth, 18).fill('#1e3a5f');
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff');
          colDefs.forEach(col => {
            const align = col.label === 'Total Harga' ? 'right' : 'left';
            doc.text(col.label, col.x + 3, rowY + 5, { width: col.w - 6, align });
          });
          rowY += 18;
        }

        // Alternate row bg
        if (idx % 2 === 0) {
          doc.rect(leftMargin, rowY, tableWidth, rowHeight).fill('#f8fafc');
        }

        doc.fontSize(7.5).font('Helvetica').fillColor('#333');

        // Tipe
        doc.text(item.item_type === 'PART' ? 'Part' : 'Jasa', colDefs[0].x + 3, rowY + 4, { width: colDefs[0].w - 6 });
        // Kategori
        doc.text(item.nama_kategori || '-', colDefs[1].x + 3, rowY + 4, { width: colDefs[1].w - 6 });
        // Nama
        doc.text(item.item_name || '-', colDefs[2].x + 3, rowY + 4, { width: colDefs[2].w - 6 });
        // Qty
        doc.text(String(item.qty || 1), colDefs[3].x + 3, rowY + 4, { width: colDefs[3].w - 6, align: 'center' });
        // Total Harga
        doc.text(formatRp(harga), colDefs[4].x + 3, rowY + 4, { width: colDefs[4].w - 6, align: 'right' });
        // Status
        const statusColor = sudah ? '#16a34a' : '#dc2626';
        doc.font('Helvetica-Bold').fillColor(statusColor)
          .text(statusLabel, colDefs[5].x + 3, rowY + 4, { width: colDefs[5].w - 6 });

        rowY += rowHeight;
      }

      // Table bottom border
      doc.moveTo(leftMargin, rowY).lineTo(leftMargin + tableWidth, rowY).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      doc.y = rowY + 10;
    }

    // ===== SUMMARY SECTION =====
    if (doc.y > 620) doc.addPage();

    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).strokeColor('#1e3a5f').lineWidth(1.5).stroke();
    doc.moveDown(0.6);

    // Summary box
    const sumY = doc.y;
    doc.rect(leftMargin, sumY, pageWidth, 80).fill('#f1f5f9');

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text('Ringkasan Status', leftMargin + 12, sumY + 8);

    // Sudah Ganti
    const col1X = leftMargin + 12;
    const col2X = leftMargin + pageWidth / 2 + 12;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#16a34a')
      .text('✓ Sudah Ganti', col1X, sumY + 26);
    doc.fontSize(8).font('Helvetica').fillColor('#333')
      .text(`Part: ${countSudahPart} item — ${formatRp(grandSudahPart)}`, col1X + 10, sumY + 40);
    doc.text(`Jasa: ${countSudahJasa} item — ${formatRp(grandSudahJasa)}`, col1X + 10, sumY + 52);
    doc.font('Helvetica-Bold').fillColor('#16a34a')
      .text(`Subtotal: ${formatRp(grandSudahPart + grandSudahJasa)}`, col1X + 10, sumY + 65);

    // Belum Ganti
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626')
      .text('✗ Belum Ganti', col2X, sumY + 26);
    doc.fontSize(8).font('Helvetica').fillColor('#333')
      .text(`Part: ${countBelumPart} item — ${formatRp(grandBelumPart)}`, col2X + 10, sumY + 40);
    doc.text(`Jasa: ${countBelumJasa} item — ${formatRp(grandBelumJasa)}`, col2X + 10, sumY + 52);
    doc.font('Helvetica-Bold').fillColor('#dc2626')
      .text(`Subtotal: ${formatRp(grandBelumPart + grandBelumJasa)}`, col2X + 10, sumY + 65);

    doc.y = sumY + 90;

    // Grand Total
    const grandTotal = grandSudahPart + grandSudahJasa + grandBelumPart + grandBelumJasa;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text(`Grand Total: ${formatRp(grandTotal)}`, leftMargin, doc.y, { align: 'right', width: pageWidth });

    doc.moveDown(1.5);

    // Disclaimer
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#333')
      .text('Harga diatas masih bersifat estimasi / perkiraan. Harga bisa berbeda tergantung actual pada saat pemesanan / pengerjaan.', leftMargin, doc.y, { width: pageWidth, align: 'center' });

    doc.moveDown(1);
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
      .text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, { align: 'right' });
    if (cabang) {
      doc.text(`${cabang.nama_cabang} — CR7 Web App`, { align: 'right' });
    } else {
      doc.text('Wijaya Toyota — CR7 Web App', { align: 'right' });
    }

    doc.end();

  } catch (err) {
    console.error('PDF export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
