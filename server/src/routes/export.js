const express = require('express');
const ExcelJS = require('exceljs');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Helper: format currency
function fmtCurrency(val) { return val ? `Rp ${Number(val).toLocaleString('id-ID')}` : 'Rp 0'; }

// Helper: get active branch info
function getCabangInfo() {
  try {
    return db.prepare('SELECT * FROM master_cabang WHERE is_active = 1 ORDER BY id LIMIT 1').get() || null;
  } catch (e) { return null; }
}

// GET /api/export/summary
router.get('/summary', authenticate, authorize('SUPER_ADMIN', 'SA'), async (req, res) => {
  try {
    const { date_from, date_to, sa_id, status } = req.query;
    let where = '1=1'; let params = [];
    if (date_from) { where += ' AND h.tanggal_input >= ?'; params.push(date_from); }
    if (date_to) { where += " AND h.tanggal_input <= ?"; params.push(date_to + ' 23:59:59'); }
    if (sa_id) { where += ' AND h.sa_id = ?'; params.push(sa_id); }
    if (status) { where += ' AND h.status_header = ?'; params.push(status); }

    const data = db.prepare(`
      SELECT h.nomor_dokumen, h.status_header, h.tanggal_input, k.no_polisi, k.no_rangka, k.model,
        t.nama_teknisi, s.nama_sa, h.foreman_validated,
        (SELECT COUNT(*) FROM service_advice_items WHERE header_id = h.id) as total_items,
        (SELECT COUNT(*) FROM service_advice_items WHERE header_id = h.id AND item_type='PART') as total_parts,
        (SELECT COUNT(*) FROM service_advice_items WHERE header_id = h.id AND item_type='JASA') as total_jasa,
        (SELECT COALESCE(SUM(COALESCE(harga_part,0)*COALESCE(qty,1)+COALESCE(harga_jasa,0)),0) FROM service_advice_items WHERE header_id = h.id AND item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED')) as outstanding
      FROM service_advice_headers h
      JOIN kendaraan k ON h.kendaraan_id = k.id
      LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      LEFT JOIN master_sa s ON h.sa_id = s.id
      WHERE ${where} ORDER BY h.tanggal_input DESC
    `).all(...params);

    const cabang = getCabangInfo();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ringkasan Saran Service');

    // Branch header info
    if (cabang) {
      ws.mergeCells('A1:L1');
      ws.getCell('A1').value = cabang.nama_cabang;
      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
      if (cabang.alamat) {
        ws.mergeCells('A2:L2');
        ws.getCell('A2').value = `${cabang.alamat}${cabang.telepon ? '  |  Telp: ' + cabang.telepon : ''}`;
        ws.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };
      }
      ws.addRow([]);
    }

    const headerRowNum = cabang ? 4 : 1;
    const headerRow = ws.getRow(headerRowNum);
    const columns = [
      { header: 'No Dokumen', key: 'nomor_dokumen', width: 22 },
      { header: 'Tanggal', key: 'tanggal_input', width: 18 },
      { header: 'No Polisi', key: 'no_polisi', width: 14 },
      { header: 'No Rangka', key: 'no_rangka', width: 22 },
      { header: 'Model', key: 'model', width: 16 },
      { header: 'Teknisi', key: 'nama_teknisi', width: 20 },
      { header: 'SA', key: 'nama_sa', width: 20 },
      { header: 'Status', key: 'status_header', width: 18 },
      { header: 'Total Item', key: 'total_items', width: 12 },
      { header: 'Part', key: 'total_parts', width: 8 },
      { header: 'Jasa', key: 'total_jasa', width: 8 },
      { header: 'Outstanding (Rp)', key: 'outstanding', width: 20 },
    ];

    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      ws.getColumn(idx + 1).width = col.width;
    });
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 12 } };

    data.forEach(r => {
      const row = ws.addRow(columns.map(c => r[c.key]));
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Ringkasan_SA_${new Date().toISOString().split('T')[0]}.xlsx`);
    await wb.xlsx.write(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/export/detail
router.get('/detail', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { date_from, date_to, sa_id, status } = req.query;
    let where = '1=1'; let params = [];
    if (date_from) { where += ' AND h.tanggal_input >= ?'; params.push(date_from); }
    if (date_to) { where += " AND h.tanggal_input <= ?"; params.push(date_to + ' 23:59:59'); }
    if (sa_id) { where += ' AND h.sa_id = ?'; params.push(sa_id); }
    if (status) { where += ' AND h.status_header = ?'; params.push(status); }

    const data = db.prepare(`
      SELECT h.nomor_dokumen, h.status_header, h.tanggal_input, k.no_polisi, k.no_rangka, k.model,
        t.nama_teknisi, s.nama_sa, h.foreman_validated, fm.nama_foreman, h.validated_at,
        i.item_type, i.item_name, i.item_description, i.qty, i.no_part, i.harga_part, i.harga_jasa,
        i.part_availability, i.item_status, i.customer_decision, i.replacement_status,
        i.replacement_date, i.replacement_note, cu.full_name as completed_by_name, i.completed_at,
        mk.nama_kategori,
        (SELECT fu.follow_up_date FROM follow_ups fu WHERE fu.item_id = i.id ORDER BY fu.created_at DESC LIMIT 1) as last_followup_date,
        (SELECT fu.follow_up_result FROM follow_ups fu WHERE fu.item_id = i.id ORDER BY fu.created_at DESC LIMIT 1) as last_followup_result,
        (SELECT fu.next_follow_up_date FROM follow_ups fu WHERE fu.item_id = i.id ORDER BY fu.created_at DESC LIMIT 1) as next_followup,
        (SELECT r.reminder_date FROM reminders r WHERE r.item_id = i.id ORDER BY r.created_at DESC LIMIT 1) as last_reminder_date,
        (SELECT r.next_reminder_date FROM reminders r WHERE r.item_id = i.id ORDER BY r.created_at DESC LIMIT 1) as next_reminder,
        uu.full_name as last_updated_by, i.updated_at
      FROM service_advice_items i
      JOIN service_advice_headers h ON i.header_id = h.id
      JOIN kendaraan k ON h.kendaraan_id = k.id
      LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      LEFT JOIN master_sa s ON h.sa_id = s.id
      LEFT JOIN master_foreman fm ON h.foreman_id = fm.id
      LEFT JOIN master_users cu ON i.completed_by = cu.id
      LEFT JOIN master_users uu ON h.updated_by = uu.id
      LEFT JOIN master_kategori_service mk ON i.kategori_id = mk.id
      WHERE ${where} ORDER BY h.tanggal_input DESC, i.id
    `).all(...params);

    const cabang = getCabangInfo();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Detail Saran Service');

    // Branch header info
    if (cabang) {
      ws.mergeCells('A1:AB1');
      ws.getCell('A1').value = cabang.nama_cabang;
      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
      if (cabang.alamat) {
        ws.mergeCells('A2:AB2');
        ws.getCell('A2').value = `${cabang.alamat}${cabang.telepon ? '  |  Telp: ' + cabang.telepon : ''}`;
        ws.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };
      }
      ws.addRow([]);
    }

    const headerRowNum = cabang ? 4 : 1;
    const headerRow = ws.getRow(headerRowNum);
    const columns = [
      { header: 'No Dokumen', key: 'nomor_dokumen', width: 22 },
      { header: 'Tanggal Input', key: 'tanggal_input', width: 18 },
      { header: 'No Polisi', key: 'no_polisi', width: 14 },
      { header: 'No Rangka', key: 'no_rangka', width: 22 },
      { header: 'Model', key: 'model', width: 16 },
      { header: 'Teknisi', key: 'nama_teknisi', width: 18 },
      { header: 'SA', key: 'nama_sa', width: 18 },
      { header: 'Foreman', key: 'nama_foreman', width: 18 },
      { header: 'Status Dok', key: 'status_header', width: 18 },
      { header: 'Tipe Item', key: 'item_type', width: 10 },
      { header: 'Kategori', key: 'nama_kategori', width: 20 },
      { header: 'Nama Item', key: 'item_name', width: 25 },
      { header: 'Deskripsi', key: 'item_description', width: 30 },
      { header: 'Qty', key: 'qty', width: 6 },
      { header: 'No Part', key: 'no_part', width: 18 },
      { header: 'Harga Part', key: 'harga_part', width: 16 },
      { header: 'Harga Jasa', key: 'harga_jasa', width: 16 },
      { header: 'Stok Part', key: 'part_availability', width: 14 },
      { header: 'Status Item', key: 'item_status', width: 20 },
      { header: 'Keputusan Customer', key: 'customer_decision', width: 20 },
      { header: 'Status Ganti', key: 'replacement_status', width: 18 },
      { header: 'Tgl Ganti', key: 'replacement_date', width: 14 },
      { header: 'Follow Up Terakhir', key: 'last_followup_date', width: 18 },
      { header: 'Hasil Follow Up', key: 'last_followup_result', width: 22 },
      { header: 'Next Follow Up', key: 'next_followup', width: 16 },
      { header: 'Reminder Terakhir', key: 'last_reminder_date', width: 18 },
      { header: 'Next Reminder', key: 'next_reminder', width: 16 },
      { header: 'Terakhir Update Oleh', key: 'last_updated_by', width: 18 },
      { header: 'Terakhir Update', key: 'updated_at', width: 18 },
    ];

    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      ws.getColumn(idx + 1).width = col.width;
    });
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: columns.length } };

    data.forEach(r => {
      ws.addRow(columns.map(c => r[c.key] ?? ''));
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Detail_SA_${new Date().toISOString().split('T')[0]}.xlsx`);
    await wb.xlsx.write(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
