const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// GET /api/users - List all users (Super Admin only)
router.get('/', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, u.created_at, u.updated_at,
             r.role_name, r.role_code
      FROM master_users u
      JOIN master_roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - Create user (Super Admin only)
router.post('/', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { username, password, full_name, role_id } = req.body;
    if (!username || !password || !full_name || !role_id) {
      return res.status(400).json({ error: 'Semua field wajib diisi.' });
    }

    const existing = db.prepare('SELECT id FROM master_users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username sudah digunakan.' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO master_users (username, password_hash, full_name, role_id)
      VALUES (?, ?, ?, ?)
    `).run(username, password_hash, full_name, role_id);

    logActivity({
      entityType: 'USER',
      entityId: result.lastInsertRowid,
      actionType: 'CREATE',
      newValue: JSON.stringify({ username, full_name, role_id }),
      description: `User baru "${full_name}" (${username}) dibuat`,
      actionBy: req.user.id
    });

    res.status(201).json({ id: result.lastInsertRowid, message: 'User berhasil dibuat.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id - Update user (Super Admin only)
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { id } = req.params;
    const { username, full_name, role_id, password } = req.body;

    const user = db.prepare('SELECT * FROM master_users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const updates = [];
    const values = [];

    if (username && username !== user.username) {
      const existing = db.prepare('SELECT id FROM master_users WHERE username = ? AND id != ?').get(username, id);
      if (existing) return res.status(400).json({ error: 'Username sudah digunakan.' });
      updates.push('username = ?');
      values.push(username);
    }
    if (full_name) { updates.push('full_name = ?'); values.push(full_name); }
    if (role_id) { updates.push('role_id = ?'); values.push(role_id); }
    if (password) { updates.push('password_hash = ?'); values.push(bcrypt.hashSync(password, 10)); }
    updates.push("updated_at = datetime('now', 'localtime')");

    if (updates.length > 1) {
      values.push(id);
      db.prepare(`UPDATE master_users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      logActivity({
        entityType: 'USER',
        entityId: parseInt(id),
        actionType: 'UPDATE',
        oldValue: JSON.stringify({ username: user.username, full_name: user.full_name }),
        newValue: JSON.stringify({ username: username || user.username, full_name: full_name || user.full_name }),
        description: `User "${user.full_name}" diperbarui`,
        actionBy: req.user.id
      });
    }

    res.json({ message: 'User berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/toggle-active - Toggle user active status (Super Admin only)
router.patch('/:id/toggle-active', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare('SELECT * FROM master_users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' });
    }

    const newStatus = user.is_active ? 0 : 1;
    db.prepare("UPDATE master_users SET is_active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newStatus, id);

    logActivity({
      entityType: 'USER',
      entityId: parseInt(id),
      actionType: 'STATUS_CHANGE',
      oldValue: user.is_active ? 'Aktif' : 'Nonaktif',
      newValue: newStatus ? 'Aktif' : 'Nonaktif',
      description: `User "${user.full_name}" ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
      actionBy: req.user.id
    });

    res.json({ message: `User berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/roles - List all roles
router.get('/roles', authenticate, (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM master_roles ORDER BY id').all();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
