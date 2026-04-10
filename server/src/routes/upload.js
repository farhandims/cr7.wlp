const express = require('express');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { logActivity } = require('../utils/logger');
const router = express.Router();

router.post('/', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib dipilih.' });
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type dan entity_id wajib diisi.' });

    const relativePath = req.file.path.replace(/\\/g, '/');
    const result = db.prepare(`
      INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_type, file_size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entity_type, entity_id, req.file.originalname, relativePath, req.file.mimetype, req.file.size, req.user.id);

    logActivity({ entityType: 'ATTACHMENT', entityId: result.lastInsertRowid, actionType: 'UPLOAD', newValue: req.file.originalname, description: `File "${req.file.originalname}" diupload`, actionBy: req.user.id });

    res.status(201).json({ id: result.lastInsertRowid, filePath: relativePath, fileName: req.file.originalname, message: 'File berhasil diupload.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:entityType/:entityId', authenticate, (req, res) => {
  try {
    const data = db.prepare(`
      SELECT a.*, u.full_name as uploaded_by_name FROM attachments a
      LEFT JOIN master_users u ON a.uploaded_by = u.id
      WHERE a.entity_type = ? AND a.entity_id = ? ORDER BY a.uploaded_at DESC
    `).all(req.params.entityType, req.params.entityId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
