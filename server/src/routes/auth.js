const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const user = db.prepare(`
      SELECT u.*, r.role_code, r.role_name
      FROM master_users u
      JOIN master_roles r ON u.role_id = r.id
      WHERE u.username = ?
    `).get(username);

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan. Hubungi Super Admin.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, roleCode: user.role_code },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logActivity({
      entityType: 'AUTH',
      entityId: user.id,
      actionType: 'LOGIN',
      description: `${user.full_name} (${user.role_name}) berhasil login`,
      actionBy: user.id
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        roleCode: user.role_code,
        roleName: user.role_name
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    fullName: req.user.full_name,
    roleCode: req.user.role_code,
    roleName: req.user.role_name
  });
});

module.exports = router;
