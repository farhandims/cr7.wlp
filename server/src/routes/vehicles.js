const express = require('express');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/search', authenticate, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const data = db.prepare(`
      SELECT k.*, (SELECT COUNT(*) FROM service_advice_headers WHERE kendaraan_id = k.id) as total_sa
      FROM kendaraan k WHERE k.no_polisi LIKE ? OR k.no_rangka LIKE ? OR k.model LIKE ?
      ORDER BY k.updated_at DESC LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/history', authenticate, (req, res) => {
  try {
    const vehicle = db.prepare('SELECT * FROM kendaraan WHERE id = ?').get(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan.' });

    const headers = db.prepare(`
      SELECT h.*, t.nama_teknisi, s.nama_sa, f.nama_foreman,
        (SELECT COUNT(*) FROM service_advice_items WHERE header_id = h.id) as total_items,
        (SELECT COALESCE(SUM(CASE WHEN item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED') THEN COALESCE(harga_part,0)*COALESCE(qty,1) + COALESCE(harga_jasa,0) ELSE 0 END),0) FROM service_advice_items WHERE header_id = h.id) as outstanding
      FROM service_advice_headers h
      LEFT JOIN master_teknisi t ON h.teknisi_id = t.id
      LEFT JOIN master_sa s ON h.sa_id = s.id
      LEFT JOIN master_foreman f ON h.foreman_id = f.id
      WHERE h.kendaraan_id = ? ORDER BY h.tanggal_input DESC
    `).all(req.params.id);

    let grandOutstanding = 0;
    for (const h of headers) {
      h.items = db.prepare('SELECT * FROM service_advice_items WHERE header_id = ? ORDER BY id').all(h.id);
      grandOutstanding += h.outstanding || 0;
    }

    res.json({ vehicle, headers, grandOutstanding });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
