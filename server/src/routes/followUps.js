const express = require('express');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const router = express.Router();

router.get('/', authenticate, (req, res) => {
  try {
    const { item_id } = req.query;
    let where = '1=1';
    let params = [];
    if (item_id) { where += ' AND fu.item_id = ?'; params.push(item_id); }
    const data = db.prepare(`
      SELECT fu.*, u.full_name as follow_up_by_name, i.item_name, i.item_type, h.nomor_dokumen, k.no_polisi
      FROM follow_ups fu LEFT JOIN master_users u ON fu.follow_up_by = u.id
      LEFT JOIN service_advice_items i ON fu.item_id = i.id
      LEFT JOIN service_advice_headers h ON i.header_id = h.id
      LEFT JOIN kendaraan k ON h.kendaraan_id = k.id
      WHERE ${where} ORDER BY fu.created_at DESC LIMIT 100
    `).all(...params);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pending', authenticate, authorize('SUPER_ADMIN', 'SA'), (req, res) => {
  try {
    let saFilter = '';
    const params = [];
    if (req.user.role_code === 'SA') {
      const sa = db.prepare('SELECT id FROM master_sa WHERE user_id = ?').get(req.user.id);
      if (sa) { saFilter = 'AND h.sa_id = ?'; params.push(sa.id); }
    }
    const data = db.prepare(`
      SELECT i.*, h.nomor_dokumen, h.sa_id, h.id as header_id, k.no_polisi, k.no_rangka, k.model,
             s.nama_sa, t.nama_teknisi
      FROM service_advice_items i
      JOIN service_advice_headers h ON i.header_id = h.id
      JOIN kendaraan k ON h.kendaraan_id = k.id
      LEFT JOIN master_sa s ON h.sa_id = s.id
      LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      WHERE i.item_status IN ('READY_FOLLOWUP','FOLLOWED_UP','WAITING_DECISION') ${saFilter}
      ORDER BY i.created_at ASC
    `).all(...params);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'SA'), (req, res) => {
  try {
    const { item_id, follow_up_date, follow_up_result, next_follow_up_date, note } = req.body;
    if (!item_id || !follow_up_date) return res.status(400).json({ error: 'Item dan tanggal wajib diisi.' });
    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(item_id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });

    db.transaction(() => {
      db.prepare('INSERT INTO follow_ups (item_id, follow_up_date, follow_up_by, follow_up_result, next_follow_up_date, note) VALUES (?,?,?,?,?,?)')
        .run(item_id, follow_up_date, req.user.id, follow_up_result || null, next_follow_up_date || null, note || null);
      db.prepare("UPDATE service_advice_items SET item_status = 'FOLLOWED_UP', updated_at = datetime('now','localtime') WHERE id = ?").run(item_id);
      logActivity({ entityType: 'ITEM', entityId: item_id, actionType: 'FOLLOW_UP', newValue: follow_up_result, description: `Follow up untuk "${item.item_name}"`, actionBy: req.user.id });
    })();
    res.status(201).json({ message: 'Follow up berhasil dicatat.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/follow-ups/:id - Edit follow up
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'SA'), (req, res) => {
  try {
    const { follow_up_date, follow_up_result, next_follow_up_date, note, item_status } = req.body;
    const fu = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(req.params.id);
    if (!fu) return res.status(404).json({ error: 'Follow up tidak ditemukan.' });

    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(fu.item_id);

    db.transaction(() => {
      const updates = [];
      const values = [];
      if (follow_up_date !== undefined) { updates.push('follow_up_date = ?'); values.push(follow_up_date); }
      if (follow_up_result !== undefined) { updates.push('follow_up_result = ?'); values.push(follow_up_result || null); }
      if (next_follow_up_date !== undefined) { updates.push('next_follow_up_date = ?'); values.push(next_follow_up_date || null); }
      if (note !== undefined) { updates.push('note = ?'); values.push(note || null); }

      if (updates.length === 0 && !item_status) return res.status(400).json({ error: 'Tidak ada field yang diubah.' });

      if (updates.length > 0) {
        values.push(req.params.id);
        db.prepare(`UPDATE follow_ups SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      // Update item status if provided
      if (item_status && item) {
        const validStatuses = ['FOLLOWED_UP', 'WAITING_DECISION', 'APPROVED', 'DEFERRED', 'REJECTED', 'READY_FOLLOWUP', 'CLOSED'];
        if (validStatuses.includes(item_status)) {
          db.prepare("UPDATE service_advice_items SET item_status = ?, customer_decision = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .run(item_status, item_status, fu.item_id);

          // Recalculate header status
          const headerItems = db.prepare('SELECT item_status FROM service_advice_items WHERE header_id = ?').all(item.header_id);
          const statuses = headerItems.map(i => i.item_status);
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

          db.prepare("UPDATE service_advice_headers SET status_header = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newStatus, item.header_id);
        }
      }

      logActivity({
        entityType: 'FOLLOW_UP',
        entityId: parseInt(req.params.id),
        actionType: 'EDIT',
        oldValue: JSON.stringify({ follow_up_date: fu.follow_up_date, follow_up_result: fu.follow_up_result, note: fu.note, item_status: item?.item_status }),
        newValue: JSON.stringify({ follow_up_date, follow_up_result, note, item_status }),
        description: `Follow up untuk "${item ? item.item_name : 'Unknown'}" diedit oleh SA${item_status ? ` (status → ${item_status})` : ''}`,
        actionBy: req.user.id
      });
    })();

    res.json({ message: 'Follow up berhasil diperbarui.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
