const express = require('express');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// ==========================================
// TEKNISI
// ==========================================
router.get('/teknisi', authenticate, (req, res) => {
  try {
    const activeOnly = req.query.active === '1';
    const query = activeOnly
      ? 'SELECT * FROM master_teknisi WHERE is_active = 1 ORDER BY nama_teknisi'
      : 'SELECT * FROM master_teknisi ORDER BY nama_teknisi';
    res.json(db.prepare(query).all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/teknisi', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_teknisi } = req.body;
    if (!nama_teknisi) return res.status(400).json({ error: 'Nama teknisi wajib diisi.' });
    const result = db.prepare('INSERT INTO master_teknisi (nama_teknisi) VALUES (?)').run(nama_teknisi);
    logActivity({ entityType: 'MASTER_TEKNISI', entityId: result.lastInsertRowid, actionType: 'CREATE', newValue: nama_teknisi, description: `Teknisi "${nama_teknisi}" ditambahkan`, actionBy: req.user.id });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Teknisi berhasil ditambahkan.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/teknisi/:id', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_teknisi, is_active } = req.body;
    const old = db.prepare('SELECT * FROM master_teknisi WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Teknisi tidak ditemukan.' });
    db.prepare("UPDATE master_teknisi SET nama_teknisi = COALESCE(?, nama_teknisi), is_active = COALESCE(?, is_active), updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(nama_teknisi || null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    logActivity({ entityType: 'MASTER_TEKNISI', entityId: parseInt(req.params.id), actionType: 'UPDATE', oldValue: old.nama_teknisi, newValue: nama_teknisi || old.nama_teknisi, description: `Teknisi diperbarui`, actionBy: req.user.id });
    res.json({ message: 'Teknisi berhasil diperbarui.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// SA (Service Advisor)
// ==========================================
router.get('/sa', authenticate, (req, res) => {
  try {
    const activeOnly = req.query.active === '1';
    const query = activeOnly
      ? `SELECT s.*, u.username FROM master_sa s LEFT JOIN master_users u ON s.user_id = u.id WHERE s.is_active = 1 ORDER BY s.nama_sa`
      : `SELECT s.*, u.username FROM master_sa s LEFT JOIN master_users u ON s.user_id = u.id ORDER BY s.nama_sa`;
    res.json(db.prepare(query).all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sa', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_sa, user_id } = req.body;
    if (!nama_sa) return res.status(400).json({ error: 'Nama SA wajib diisi.' });
    const result = db.prepare('INSERT INTO master_sa (nama_sa, user_id) VALUES (?, ?)').run(nama_sa, user_id || null);
    logActivity({ entityType: 'MASTER_SA', entityId: result.lastInsertRowid, actionType: 'CREATE', newValue: nama_sa, description: `SA "${nama_sa}" ditambahkan`, actionBy: req.user.id });
    res.status(201).json({ id: result.lastInsertRowid, message: 'SA berhasil ditambahkan.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sa/:id', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_sa, user_id, is_active } = req.body;
    const old = db.prepare('SELECT * FROM master_sa WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'SA tidak ditemukan.' });
    db.prepare("UPDATE master_sa SET nama_sa = COALESCE(?, nama_sa), user_id = COALESCE(?, user_id), is_active = COALESCE(?, is_active), updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(nama_sa || null, user_id !== undefined ? user_id : null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    logActivity({ entityType: 'MASTER_SA', entityId: parseInt(req.params.id), actionType: 'UPDATE', oldValue: old.nama_sa, newValue: nama_sa || old.nama_sa, description: `SA diperbarui`, actionBy: req.user.id });
    res.json({ message: 'SA berhasil diperbarui.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// FOREMAN
// ==========================================
router.get('/foreman', authenticate, (req, res) => {
  try {
    const activeOnly = req.query.active === '1';
    const query = activeOnly
      ? `SELECT f.*, u.username FROM master_foreman f LEFT JOIN master_users u ON f.user_id = u.id WHERE f.is_active = 1 ORDER BY f.nama_foreman`
      : `SELECT f.*, u.username FROM master_foreman f LEFT JOIN master_users u ON f.user_id = u.id ORDER BY f.nama_foreman`;
    res.json(db.prepare(query).all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/foreman', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_foreman, user_id } = req.body;
    if (!nama_foreman) return res.status(400).json({ error: 'Nama foreman wajib diisi.' });
    const result = db.prepare('INSERT INTO master_foreman (nama_foreman, user_id) VALUES (?, ?)').run(nama_foreman, user_id || null);
    logActivity({ entityType: 'MASTER_FOREMAN', entityId: result.lastInsertRowid, actionType: 'CREATE', newValue: nama_foreman, description: `Foreman "${nama_foreman}" ditambahkan`, actionBy: req.user.id });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Foreman berhasil ditambahkan.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/foreman/:id', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_foreman, user_id, is_active } = req.body;
    const old = db.prepare('SELECT * FROM master_foreman WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Foreman tidak ditemukan.' });
    db.prepare("UPDATE master_foreman SET nama_foreman = COALESCE(?, nama_foreman), user_id = COALESCE(?, user_id), is_active = COALESCE(?, is_active), updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(nama_foreman || null, user_id !== undefined ? user_id : null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    logActivity({ entityType: 'MASTER_FOREMAN', entityId: parseInt(req.params.id), actionType: 'UPDATE', oldValue: old.nama_foreman, newValue: nama_foreman || old.nama_foreman, description: `Foreman diperbarui`, actionBy: req.user.id });
    res.json({ message: 'Foreman berhasil diperbarui.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// KATEGORI SERVICE
// ==========================================
router.get('/kategori', authenticate, (req, res) => {
  try {
    const activeOnly = req.query.active === '1';
    const query = activeOnly
      ? 'SELECT * FROM master_kategori_service WHERE is_active = 1 ORDER BY nama_kategori'
      : 'SELECT * FROM master_kategori_service ORDER BY id';
    res.json(db.prepare(query).all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/kategori', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_kategori } = req.body;
    if (!nama_kategori) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
    const result = db.prepare('INSERT INTO master_kategori_service (nama_kategori) VALUES (?)').run(nama_kategori.toUpperCase());
    logActivity({ entityType: 'MASTER_KATEGORI', entityId: result.lastInsertRowid, actionType: 'CREATE', newValue: nama_kategori, description: `Kategori "${nama_kategori}" ditambahkan`, actionBy: req.user.id });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Kategori berhasil ditambahkan.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/kategori/:id', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_kategori, is_active } = req.body;
    const old = db.prepare('SELECT * FROM master_kategori_service WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    db.prepare("UPDATE master_kategori_service SET nama_kategori = COALESCE(?, nama_kategori), is_active = COALESCE(?, is_active), updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(nama_kategori ? nama_kategori.toUpperCase() : null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    logActivity({ entityType: 'MASTER_KATEGORI', entityId: parseInt(req.params.id), actionType: 'UPDATE', oldValue: old.nama_kategori, newValue: nama_kategori || old.nama_kategori, description: `Kategori diperbarui`, actionBy: req.user.id });
    res.json({ message: 'Kategori berhasil diperbarui.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// CABANG (Branch)
// ==========================================
router.get('/cabang', authenticate, (req, res) => {
  try {
    const activeOnly = req.query.active === '1';
    const query = activeOnly
      ? 'SELECT * FROM master_cabang WHERE is_active = 1 ORDER BY nama_cabang'
      : 'SELECT * FROM master_cabang ORDER BY id';
    res.json(db.prepare(query).all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/cabang', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_cabang, alamat, telepon } = req.body;
    if (!nama_cabang) return res.status(400).json({ error: 'Nama cabang wajib diisi.' });
    const result = db.prepare('INSERT INTO master_cabang (nama_cabang, alamat, telepon) VALUES (?, ?, ?)').run(nama_cabang, alamat || null, telepon || null);
    logActivity({ entityType: 'MASTER_CABANG', entityId: result.lastInsertRowid, actionType: 'CREATE', newValue: nama_cabang, description: `Cabang "${nama_cabang}" ditambahkan`, actionBy: req.user.id });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Cabang berhasil ditambahkan.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/cabang/:id', authenticate, authorize('SUPER_ADMIN'), (req, res) => {
  try {
    const { nama_cabang, alamat, telepon, is_active } = req.body;
    const old = db.prepare('SELECT * FROM master_cabang WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Cabang tidak ditemukan.' });
    db.prepare("UPDATE master_cabang SET nama_cabang = COALESCE(?, nama_cabang), alamat = COALESCE(?, alamat), telepon = COALESCE(?, telepon), is_active = COALESCE(?, is_active), updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(nama_cabang || null, alamat !== undefined ? alamat : null, telepon !== undefined ? telepon : null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    logActivity({ entityType: 'MASTER_CABANG', entityId: parseInt(req.params.id), actionType: 'UPDATE', oldValue: old.nama_cabang, newValue: nama_cabang || old.nama_cabang, description: `Cabang diperbarui`, actionBy: req.user.id });
    res.json({ message: 'Cabang berhasil diperbarui.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
