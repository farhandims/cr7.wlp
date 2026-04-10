const express = require('express');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { entity_type, action_type, date_from, date_to, page = 1, limit = 50 } = req.query;
    let where = '1=1'; let params = [];
    if (entity_type) { where += ' AND al.entity_type = ?'; params.push(entity_type); }
    if (action_type) { where += ' AND al.action_type = ?'; params.push(action_type); }
    if (date_from) { where += ' AND al.action_at >= ?'; params.push(date_from); }
    if (date_to) { where += " AND al.action_at <= ?"; params.push(date_to + ' 23:59:59'); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const total = db.prepare(`SELECT COUNT(*) as c FROM activity_logs al WHERE ${where}`).get(...params).c;
    params.push(parseInt(limit), offset);
    const data = db.prepare(`
      SELECT al.*, u.full_name as action_by_name, u.username
      FROM activity_logs al LEFT JOIN master_users u ON al.action_by = u.id
      WHERE ${where} ORDER BY al.action_at DESC LIMIT ? OFFSET ?
    `).all(...params);

    res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
