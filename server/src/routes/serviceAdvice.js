const express = require('express');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// Generate document number: SA-YYYYMMDD-NNNN
function generateDocNumber() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `SA-${dateStr}-`;
  const last = db.prepare(`SELECT nomor_dokumen FROM service_advice_headers WHERE nomor_dokumen LIKE ? ORDER BY nomor_dokumen DESC LIMIT 1`).get(`${prefix}%`);
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.nomor_dokumen.split('-').pop());
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Recalculate header status based on items
function recalcHeaderStatus(headerId) {
  const items = db.prepare('SELECT item_status FROM service_advice_items WHERE header_id = ?').all(headerId);
  if (items.length === 0) return;

  const statuses = items.map(i => i.item_status);
  const closedStatuses = ['REPLACED', 'REPLACED_OTHER', 'REPLACED_NONORI', 'CLOSED', 'REJECTED'];
  const allClosed = statuses.every(s => closedStatuses.includes(s));
  const someClosed = statuses.some(s => closedStatuses.includes(s));
  const hasFollowUp = statuses.some(s => ['FOLLOWED_UP', 'WAITING_DECISION', 'APPROVED', 'DEFERRED'].includes(s));
  const allReady = statuses.every(s => s === 'READY_FOLLOWUP' || closedStatuses.includes(s));
  const hasWaiting = statuses.some(s => ['WAITING_PARTMAN', 'WAITING_SA_PRICING'].includes(s));

  let newStatus;
  if (allClosed) newStatus = 'CLOSED';
  else if (someClosed) newStatus = 'PARTIALLY_CLOSED';
  else if (hasFollowUp) newStatus = 'FOLLOWUP_ONGOING';
  else if (allReady) newStatus = 'WAITING_FOLLOWUP';
  else if (hasWaiting) newStatus = 'IN_PROGRESS';
  else newStatus = 'OPEN';

  db.prepare("UPDATE service_advice_headers SET status_header = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newStatus, headerId);
}

// Validate No Rangka: max 17 chars, no spaces, no letter O
function validateNoRangka(no_rangka) {
  if (!no_rangka) return 'No Rangka wajib diisi.';
  const clean = no_rangka.replace(/\s/g, '').toUpperCase();
  if (clean.length > 17) return 'No Rangka maksimal 17 karakter.';
  if (/O/.test(clean)) return 'No Rangka tidak boleh mengandung huruf O (gunakan angka 0).';
  if (!/^[A-NP-Z0-9]+$/.test(clean)) return 'No Rangka hanya boleh huruf (kecuali O) dan angka.';
  return null;
}

// GET /api/service-advice - List with filters
router.get('/', authenticate, (req, res) => {
  try {
    const { status, sa_id, teknisi_id, date_from, date_to, search, page = 1, limit = 20 } = req.query;
    let where = ['1=1'];
    let params = [];

    // Role-based filtering
    if (req.user.role_code === 'TEKNISI') {
      where.push('h.created_by = ?');
      params.push(req.user.id);
    } else if (req.user.role_code === 'SA') {
      const sa = db.prepare('SELECT id FROM master_sa WHERE user_id = ?').get(req.user.id);
      if (sa) { where.push('h.sa_id = ?'); params.push(sa.id); }
    } else if (req.user.role_code === 'PARTMAN') {
      where.push(`h.id IN (SELECT header_id FROM service_advice_items WHERE item_type = 'PART')`);
    }

    if (status) { where.push('h.status_header = ?'); params.push(status); }
    if (sa_id) { where.push('h.sa_id = ?'); params.push(sa_id); }
    if (teknisi_id) { where.push('h.teknisi_id = ?'); params.push(teknisi_id); }
    if (date_from) { where.push('h.tanggal_input >= ?'); params.push(date_from); }
    if (date_to) { where.push('h.tanggal_input <= ?'); params.push(date_to + ' 23:59:59'); }
    if (search) {
      where.push('(k.no_polisi LIKE ? OR k.no_rangka LIKE ? OR h.nomor_dokumen LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const countQuery = `SELECT COUNT(*) as total FROM service_advice_headers h JOIN kendaraan k ON h.kendaraan_id = k.id WHERE ${where.join(' AND ')}`;
    const total = db.prepare(countQuery).get(...params).total;

    const dataQuery = `
      SELECT h.*, k.no_polisi, k.no_rangka, k.model,
             t.nama_teknisi, s.nama_sa,
             (SELECT COUNT(*) FROM service_advice_items WHERE header_id = h.id) as total_items,
             (SELECT COUNT(*) FROM service_advice_items WHERE header_id = h.id AND item_type = 'PART') as total_parts,
             (SELECT COUNT(*) FROM service_advice_items WHERE header_id = h.id AND item_type = 'JASA') as total_jasa,
             (SELECT COALESCE(SUM(CASE WHEN item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED') THEN COALESCE(harga_part,0) + COALESCE(harga_jasa,0) ELSE 0 END),0) FROM service_advice_items WHERE header_id = h.id) as total_outstanding
      FROM service_advice_headers h
      JOIN kendaraan k ON h.kendaraan_id = k.id
      LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      LEFT JOIN master_sa s ON h.sa_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY h.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);
    const data = db.prepare(dataQuery).all(...params);

    res.json({ data, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/service-advice/:id - Detail
router.get('/:id', authenticate, (req, res) => {
  try {
    const header = db.prepare(`
      SELECT h.*, k.no_polisi, k.no_rangka, k.model, k.id as vehicle_id,
             t.nama_teknisi, s.nama_sa,
             f.nama_foreman,
             cu.full_name as created_by_name, uu.full_name as updated_by_name
      FROM service_advice_headers h
      JOIN kendaraan k ON h.kendaraan_id = k.id
      LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      LEFT JOIN master_sa s ON h.sa_id = s.id
      LEFT JOIN master_foreman f ON h.foreman_id = f.id
      LEFT JOIN master_users cu ON h.created_by = cu.id
      LEFT JOIN master_users uu ON h.updated_by = uu.id
      WHERE h.id = ?
    `).get(req.params.id);

    if (!header) return res.status(404).json({ error: 'Data tidak ditemukan.' });

    const items = db.prepare(`
      SELECT i.*, cu.full_name as completed_by_name, mk.nama_kategori
      FROM service_advice_items i
      LEFT JOIN master_users cu ON i.completed_by = cu.id
      LEFT JOIN master_kategori_service mk ON i.kategori_id = mk.id
      WHERE i.header_id = ?
      ORDER BY i.id
    `).all(req.params.id);

    // Get follow-ups and reminders for each item
    for (const item of items) {
      item.follow_ups = db.prepare(`
        SELECT fu.*, u.full_name as follow_up_by_name
        FROM follow_ups fu
        LEFT JOIN master_users u ON fu.follow_up_by = u.id
        WHERE fu.item_id = ?
        ORDER BY fu.follow_up_date DESC
      `).all(item.id);

      item.reminders = db.prepare(`
        SELECT r.*, u.full_name as reminder_by_name
        FROM reminders r
        LEFT JOIN master_users u ON r.reminder_by = u.id
        WHERE r.item_id = ?
        ORDER BY r.reminder_date DESC
      `).all(item.id);

      item.attachments = db.prepare(`
        SELECT a.*, u.full_name as uploaded_by_name
        FROM attachments a
        LEFT JOIN master_users u ON a.uploaded_by = u.id
        WHERE a.entity_type = 'ITEM' AND a.entity_id = ?
        ORDER BY a.uploaded_at DESC
      `).all(item.id);
    }

    const activityLogs = db.prepare(`
      SELECT al.*, u.full_name as action_by_name
      FROM activity_logs al
      LEFT JOIN master_users u ON al.action_by = u.id
      WHERE (al.entity_type = 'SERVICE_ADVICE' AND al.entity_id = ?)
         OR (al.entity_type = 'ITEM' AND al.entity_id IN (SELECT id FROM service_advice_items WHERE header_id = ?))
      ORDER BY al.action_at DESC
      LIMIT 50
    `).all(req.params.id, req.params.id);

    // Calculate totals
    const totals = {
      totalParts: items.filter(i => i.item_type === 'PART').length,
      totalJasa: items.filter(i => i.item_type === 'JASA').length,
      outstandingPart: items.filter(i => i.item_type === 'PART' && !['REPLACED', 'REPLACED_OTHER', 'REPLACED_NONORI', 'CLOSED', 'REJECTED'].includes(i.item_status)).reduce((sum, i) => sum + (i.harga_part || 0) * (i.qty || 1), 0),
      outstandingJasa: items.filter(i => i.item_type === 'JASA' && !['REPLACED', 'REPLACED_OTHER', 'REPLACED_NONORI', 'CLOSED', 'REJECTED'].includes(i.item_status)).reduce((sum, i) => sum + (i.harga_jasa || 0), 0),
    };
    totals.grandTotal = totals.outstandingPart + totals.outstandingJasa;

    res.json({ header, items, activityLogs, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/service-advice - Create new (Teknisi / Super Admin / SA)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'TEKNISI', 'SA'), (req, res) => {
  try {
    let { no_polisi, no_rangka, model, teknisi_id, sa_id, note, items, submit } = req.body;

    // Clean & validate
    no_polisi = (no_polisi || '').replace(/\s/g, '').toUpperCase();
    no_rangka = (no_rangka || '').replace(/\s/g, '').toUpperCase();

    if (!no_polisi || !no_rangka || !model || !teknisi_id || !sa_id) {
      return res.status(400).json({ error: 'Data kendaraan, teknisi, dan SA wajib diisi.' });
    }

    const vinError = validateNoRangka(no_rangka);
    if (vinError) return res.status(400).json({ error: vinError });

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Minimal harus ada 1 item saran.' });
    }

    const transaction = db.transaction(() => {
      // Upsert kendaraan
      let kendaraan = db.prepare('SELECT id FROM kendaraan WHERE no_rangka = ?').get(no_rangka);
      if (kendaraan) {
        db.prepare("UPDATE kendaraan SET no_polisi = ?, model = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
          .run(no_polisi, model, kendaraan.id);
      } else {
        const kResult = db.prepare('INSERT INTO kendaraan (no_polisi, no_rangka, model) VALUES (?, ?, ?)').run(no_polisi, no_rangka, model);
        kendaraan = { id: kResult.lastInsertRowid };
      }

      const nomorDokumen = generateDocNumber();
      const statusHeader = submit ? 'OPEN' : 'DRAFT';

      const hResult = db.prepare(`
        INSERT INTO service_advice_headers (kendaraan_id, nomor_dokumen, status_header, teknisi_id, sa_id, note, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(kendaraan.id, nomorDokumen, statusHeader, teknisi_id, sa_id, note || null, req.user.id, req.user.id);

      const headerId = hResult.lastInsertRowid;

      // Insert items
      const insertItem = db.prepare(`
        INSERT INTO service_advice_items (header_id, item_type, item_name, item_description, qty, item_status, kategori_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        if (!item.item_type || !item.item_name) continue;
        let itemStatus = 'NEW';
        if (submit) {
          itemStatus = item.item_type === 'PART' ? 'WAITING_PARTMAN' : 'WAITING_SA_PRICING';
        }
        insertItem.run(headerId, item.item_type, item.item_name.toUpperCase(), item.item_description || null, item.qty || 1, itemStatus, item.kategori_id || null);
      }

      logActivity({
        entityType: 'SERVICE_ADVICE',
        entityId: headerId,
        actionType: 'CREATE',
        newValue: nomorDokumen,
        description: `Saran Service ${nomorDokumen} dibuat untuk ${no_polisi} (${model})`,
        actionBy: req.user.id
      });

      return { id: headerId, nomorDokumen };
    });

    const result = transaction();
    res.status(201).json({ id: result.id, nomor_dokumen: result.nomorDokumen, message: 'Data saran service berhasil disimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/service-advice/:id/add-items - SA / SUPER_ADMIN add items to existing advice
router.post('/:id/add-items', authenticate, authorize('SUPER_ADMIN', 'SA', 'TEKNISI'), (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'Minimal 1 item harus diisi.' });

    const header = db.prepare('SELECT * FROM service_advice_headers WHERE id = ?').get(req.params.id);
    if (!header) return res.status(404).json({ error: 'Data tidak ditemukan.' });

    const transaction = db.transaction(() => {
      const insertItem = db.prepare(`
        INSERT INTO service_advice_items (header_id, item_type, item_name, item_description, qty, item_status, kategori_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        if (!item.item_type || !item.item_name) continue;
        const itemStatus = item.item_type === 'PART' ? 'WAITING_PARTMAN' : 'WAITING_SA_PRICING';
        insertItem.run(req.params.id, item.item_type, item.item_name.toUpperCase(), item.item_description || null, item.qty || 1, itemStatus, item.kategori_id || null);
      }

      db.prepare("UPDATE service_advice_headers SET updated_by = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(req.user.id, req.params.id);

      recalcHeaderStatus(parseInt(req.params.id));

      logActivity({
        entityType: 'SERVICE_ADVICE',
        entityId: parseInt(req.params.id),
        actionType: 'ADD_ITEMS',
        newValue: `${items.length} item`,
        description: `${items.length} item baru ditambahkan ke ${header.nomor_dokumen}`,
        actionBy: req.user.id
      });
    });

    transaction();
    res.json({ message: `${items.length} item berhasil ditambahkan.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/service-advice/:id/submit - Submit draft
router.put('/:id/submit', authenticate, authorize('SUPER_ADMIN', 'TEKNISI', 'SA'), (req, res) => {
  try {
    const header = db.prepare('SELECT * FROM service_advice_headers WHERE id = ?').get(req.params.id);
    if (!header) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    if (header.status_header !== 'DRAFT') return res.status(400).json({ error: 'Hanya data DRAFT yang bisa disubmit.' });

    db.transaction(() => {
      db.prepare("UPDATE service_advice_headers SET status_header = 'OPEN', updated_by = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(req.user.id, req.params.id);

      // Update item statuses
      db.prepare("UPDATE service_advice_items SET item_status = 'WAITING_PARTMAN', updated_at = datetime('now', 'localtime') WHERE header_id = ? AND item_type = 'PART'").run(req.params.id);
      db.prepare("UPDATE service_advice_items SET item_status = 'WAITING_SA_PRICING', updated_at = datetime('now', 'localtime') WHERE header_id = ? AND item_type = 'JASA'").run(req.params.id);

      logActivity({
        entityType: 'SERVICE_ADVICE',
        entityId: parseInt(req.params.id),
        actionType: 'STATUS_CHANGE',
        oldValue: 'DRAFT',
        newValue: 'OPEN',
        description: `Saran Service ${header.nomor_dokumen} disubmit`,
        actionBy: req.user.id
      });
    })();

    res.json({ message: 'Data berhasil disubmit.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/service-advice/:id/validate - Foreman validation
router.put('/:id/validate', authenticate, authorize('SUPER_ADMIN', 'FOREMAN'), (req, res) => {
  try {
    const { foreman_id, validation_note } = req.body;
    const header = db.prepare('SELECT * FROM service_advice_headers WHERE id = ?').get(req.params.id);
    if (!header) return res.status(404).json({ error: 'Data tidak ditemukan.' });

    db.prepare(`
      UPDATE service_advice_headers 
      SET foreman_validated = 1, foreman_id = ?, validated_at = datetime('now', 'localtime'), 
          validation_note = ?, updated_by = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(foreman_id, validation_note || null, req.user.id, req.params.id);

    logActivity({
      entityType: 'SERVICE_ADVICE',
      entityId: parseInt(req.params.id),
      actionType: 'VALIDATION',
      newValue: 'Validated',
      description: `Saran Service ${header.nomor_dokumen} divalidasi oleh Foreman`,
      actionBy: req.user.id
    });

    res.json({ message: 'Validasi berhasil.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
