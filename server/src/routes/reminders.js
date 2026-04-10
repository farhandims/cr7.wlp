const express = require('express');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const router = express.Router();

router.get('/', authenticate, (req, res) => {
  try {
    const { item_id } = req.query;
    let where = '1=1'; let params = [];
    if (item_id) { where += ' AND r.item_id = ?'; params.push(item_id); }
    const data = db.prepare(`
      SELECT r.*, u.full_name as reminder_by_name, i.item_name, i.item_type, h.nomor_dokumen, k.no_polisi
      FROM reminders r LEFT JOIN master_users u ON r.reminder_by = u.id
      LEFT JOIN service_advice_items i ON r.item_id = i.id
      LEFT JOIN service_advice_headers h ON i.header_id = h.id
      LEFT JOIN kendaraan k ON h.kendaraan_id = k.id
      WHERE ${where} ORDER BY r.created_at DESC LIMIT 100
    `).all(...params);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pending', authenticate, authorize('SUPER_ADMIN', 'MRA'), (req, res) => {
  try {
    const data = db.prepare(`
      SELECT i.*, h.nomor_dokumen, h.sa_id, k.no_polisi, k.no_rangka, k.model, s.nama_sa, t.nama_teknisi,
        (SELECT r2.next_reminder_date FROM reminders r2 WHERE r2.item_id = i.id ORDER BY r2.created_at DESC LIMIT 1) as next_reminder
      FROM service_advice_items i
      JOIN service_advice_headers h ON i.header_id = h.id
      JOIN kendaraan k ON h.kendaraan_id = k.id
      LEFT JOIN master_sa s ON h.sa_id = s.id LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      WHERE i.item_status IN ('FOLLOWED_UP','WAITING_DECISION','APPROVED','DEFERRED')
        AND i.item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED')
      ORDER BY i.created_at ASC
    `).all();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'MRA'), (req, res) => {
  try {
    const { item_id, reminder_date, reminder_result, next_reminder_date, note } = req.body;
    if (!item_id || !reminder_date) return res.status(400).json({ error: 'Item dan tanggal wajib diisi.' });
    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(item_id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });
    db.prepare('INSERT INTO reminders (item_id, reminder_date, reminder_by, reminder_result, next_reminder_date, note) VALUES (?,?,?,?,?,?)')
      .run(item_id, reminder_date, req.user.id, reminder_result || null, next_reminder_date || null, note || null);
    logActivity({ entityType: 'ITEM', entityId: item_id, actionType: 'REMINDER', newValue: reminder_result, description: `Reminder untuk "${item.item_name}"`, actionBy: req.user.id });
    res.status(201).json({ message: 'Reminder berhasil dicatat.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
