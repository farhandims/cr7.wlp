const express = require('express');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// Helper: recalculate header status
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

// GET /api/items/part-suggestions - Autocomplete from history
router.get('/part-suggestions', authenticate, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const data = db.prepare(`
      SELECT DISTINCT item_name, no_part, harga_part
      FROM service_advice_items
      WHERE no_part IS NOT NULL AND no_part != '' AND item_type = 'PART'
        AND (item_name LIKE ? OR no_part LIKE ?)
      ORDER BY item_name
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/items/:id/edit - Edit item (name, no_part, price) - preventive correction
router.put('/:id/edit', authenticate, authorize('SUPER_ADMIN', 'SA'), (req, res) => {
  try {
    const { item_type, item_name, no_part, harga, harga_part, harga_jasa, kategori_id } = req.body;
    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });

    const updates = [];
    const values = [];
    if (item_type !== undefined && ['PART','JASA'].includes(item_type)) { updates.push('item_type = ?'); values.push(item_type); }
    if (item_name !== undefined) { updates.push('item_name = ?'); values.push(item_name.toUpperCase()); }
    if (kategori_id !== undefined) { updates.push('kategori_id = ?'); values.push(kategori_id || null); }
    if (no_part !== undefined) { updates.push('no_part = ?'); values.push(no_part ? no_part.toUpperCase() : no_part); }

    // Determine effective item type (after potential type change)
    const effectiveType = (item_type !== undefined && ['PART','JASA'].includes(item_type)) ? item_type : item.item_type;

    // Support single 'harga' field: map to correct column based on effective item type
    if (harga !== undefined) {
      if (effectiveType === 'PART') {
        updates.push('harga_part = ?'); values.push(parseFloat(harga) || 0);
      } else {
        updates.push('harga_jasa = ?'); values.push(parseFloat(harga) || 0);
      }
    }
    // Also support direct harga_part/harga_jasa for backwards compatibility
    if (harga_part !== undefined) { updates.push('harga_part = ?'); values.push(parseFloat(harga_part) || 0); }
    if (harga_jasa !== undefined) { updates.push('harga_jasa = ?'); values.push(parseFloat(harga_jasa) || 0); }

    if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field yang diubah.' });

    updates.push("updated_at = datetime('now', 'localtime')");
    values.push(req.params.id);

    db.transaction(() => {
      db.prepare(`UPDATE service_advice_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      logActivity({
        entityType: 'ITEM',
        entityId: parseInt(req.params.id),
        actionType: 'EDIT',
        oldValue: JSON.stringify({ item_type: item.item_type, item_name: item.item_name, no_part: item.no_part, harga_part: item.harga_part, harga_jasa: item.harga_jasa }),
        newValue: JSON.stringify({ item_type, item_name, no_part, harga }),
        description: `Item "${item.item_name}" diedit (koreksi data)`,
        actionBy: req.user.id
      });
    })();

    res.json({ message: 'Item berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/items/:id/part-info - Partman fills part data
router.put('/:id/part-info', authenticate, authorize('SUPER_ADMIN', 'PARTMAN'), (req, res) => {
  try {
    let { no_part, harga_part, part_availability, item_name } = req.body;
    no_part = no_part ? no_part.toUpperCase() : no_part;
    if (item_name) item_name = item_name.toUpperCase();

    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });
    if (item.item_type !== 'PART') return res.status(400).json({ error: 'Item ini bukan tipe PART.' });

    db.transaction(() => {
      const updates = ['no_part = ?', 'harga_part = ?', 'part_availability = ?', "item_status = 'READY_FOLLOWUP'", "updated_at = datetime('now', 'localtime')"];
      const values = [no_part, harga_part || 0, part_availability];

      if (item_name !== undefined && item_name !== null && item_name !== '') {
        updates.splice(0, 0, 'item_name = ?');
        values.splice(0, 0, item_name);
      }

      values.push(req.params.id);
      db.prepare(`UPDATE service_advice_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      logActivity({
        entityType: 'ITEM',
        entityId: parseInt(req.params.id),
        actionType: 'PART_UPDATE',
        oldValue: JSON.stringify({ item_name: item.item_name, no_part: item.no_part, harga_part: item.harga_part }),
        newValue: JSON.stringify({ item_name: item_name || item.item_name, no_part, harga_part, part_availability }),
        description: `Data part "${item_name || item.item_name}" dilengkapi oleh Partman`,
        actionBy: req.user.id
      });

      recalcHeaderStatus(item.header_id);
    })();

    res.json({ message: 'Data part berhasil dilengkapi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/items/:id/service-price - SA fills service price
router.put('/:id/service-price', authenticate, authorize('SUPER_ADMIN', 'SA'), (req, res) => {
  try {
    const { harga_jasa } = req.body;
    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });
    if (item.item_type !== 'JASA') return res.status(400).json({ error: 'Item ini bukan tipe JASA.' });
    if (harga_jasa < 0) return res.status(400).json({ error: 'Harga tidak boleh negatif.' });

    db.transaction(() => {
      db.prepare(`
        UPDATE service_advice_items 
        SET harga_jasa = ?, item_status = 'READY_FOLLOWUP', updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(harga_jasa || 0, req.params.id);

      logActivity({
        entityType: 'ITEM',
        entityId: parseInt(req.params.id),
        actionType: 'PRICE_UPDATE',
        oldValue: String(item.harga_jasa),
        newValue: String(harga_jasa),
        description: `Harga jasa "${item.item_name}" diisi oleh SA`,
        actionBy: req.user.id
      });

      recalcHeaderStatus(item.header_id);
    })();

    res.json({ message: 'Harga jasa berhasil diisi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/items/:id/status - Update item status (follow up result, customer decision)
router.put('/:id/status', authenticate, authorize('SUPER_ADMIN', 'SA', 'TEKNISI'), (req, res) => {
  try {
    const { item_status, customer_decision } = req.body;
    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });

    const validStatuses = ['FOLLOWED_UP', 'WAITING_DECISION', 'APPROVED', 'DEFERRED', 'REJECTED', 'CLOSED'];
    if (item_status && !validStatuses.includes(item_status)) {
      return res.status(400).json({ error: 'Status tidak valid.' });
    }

    db.transaction(() => {
      const updates = [];
      const values = [];
      if (item_status) { updates.push('item_status = ?'); values.push(item_status); }
      if (customer_decision) { updates.push('customer_decision = ?'); values.push(customer_decision); }
      updates.push("updated_at = datetime('now', 'localtime')");
      values.push(req.params.id);

      db.prepare(`UPDATE service_advice_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      logActivity({
        entityType: 'ITEM',
        entityId: parseInt(req.params.id),
        actionType: 'STATUS_CHANGE',
        oldValue: item.item_status,
        newValue: item_status || item.item_status,
        description: `Status item "${item.item_name}" diubah menjadi ${item_status || item.item_status}`,
        actionBy: req.user.id
      });

      recalcHeaderStatus(item.header_id);
    })();

    res.json({ message: 'Status berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/items/:id/replacement - Update replacement status
router.put('/:id/replacement', authenticate, authorize('SUPER_ADMIN', 'SA', 'TEKNISI'), (req, res) => {
  try {
    const { replacement_status, replacement_note } = req.body;
    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });

    const validReplacements = ['REPLACED', 'REPLACED_OTHER', 'REPLACED_NONORI'];
    if (!validReplacements.includes(replacement_status)) {
      return res.status(400).json({ error: 'Status replacement tidak valid.' });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE service_advice_items 
        SET item_status = ?, replacement_status = ?, replacement_date = datetime('now', 'localtime'),
            replacement_note = ?, completed_by = ?, completed_at = datetime('now', 'localtime'),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(replacement_status, replacement_status, replacement_note || null, req.user.id, req.params.id);

      logActivity({
        entityType: 'ITEM',
        entityId: parseInt(req.params.id),
        actionType: 'REPLACEMENT',
        oldValue: item.item_status,
        newValue: replacement_status,
        description: `Item "${item.item_name}" ditandai ${replacement_status}`,
        actionBy: req.user.id
      });

      recalcHeaderStatus(item.header_id);
    })();

    res.json({ message: 'Status penggantian berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/items/:id - Delete item (SUPER_ADMIN only)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM service_advice_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });

    db.transaction(() => {
      // Delete related follow-ups, reminders, attachments
      db.prepare('DELETE FROM follow_ups WHERE item_id = ?').run(req.params.id);
      db.prepare('DELETE FROM reminders WHERE item_id = ?').run(req.params.id);
      db.prepare("DELETE FROM attachments WHERE entity_type = 'ITEM' AND entity_id = ?").run(req.params.id);
      db.prepare('DELETE FROM service_advice_items WHERE id = ?').run(req.params.id);

      logActivity({
        entityType: 'ITEM',
        entityId: parseInt(req.params.id),
        actionType: 'DELETE',
        oldValue: item.item_name,
        description: `Item "${item.item_name}" (${item.item_type}) dihapus oleh Super Admin`,
        actionBy: req.user.id
      });

      recalcHeaderStatus(item.header_id);
    })();

    res.json({ message: 'Item berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
