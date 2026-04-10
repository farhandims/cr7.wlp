const express = require('express');
const { db } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/summary', authenticate, (req, res) => {
  try {
    const { date_from, date_to, sa_id, teknisi_id } = req.query;
    let where = '1=1'; let params = [];
    if (date_from) { where += ' AND h.tanggal_input >= ?'; params.push(date_from); }
    if (date_to) { where += " AND h.tanggal_input <= ?"; params.push(date_to + ' 23:59:59'); }
    if (sa_id) { where += ' AND h.sa_id = ?'; params.push(sa_id); }
    if (teknisi_id) { where += ' AND h.teknisi_id = ?'; params.push(teknisi_id); }

    const totalVehicles = db.prepare(`SELECT COUNT(DISTINCT h.kendaraan_id) as c FROM service_advice_headers h WHERE ${where}`).get(...params).c;
    const totalHeaders = db.prepare(`SELECT COUNT(*) as c FROM service_advice_headers h WHERE ${where}`).get(...params).c;

    const itemStats = db.prepare(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN i.item_type='PART' THEN 1 ELSE 0 END) as total_parts,
        SUM(CASE WHEN i.item_type='JASA' THEN 1 ELSE 0 END) as total_jasa,
        SUM(CASE WHEN i.item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED') THEN 1 ELSE 0 END) as total_open,
        SUM(CASE WHEN i.item_status IN ('READY_FOLLOWUP','NEW','WAITING_PARTMAN','WAITING_SA_PRICING') THEN 1 ELSE 0 END) as total_not_followed,
        SUM(CASE WHEN i.item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED') THEN 1 ELSE 0 END) as total_outstanding,
        SUM(CASE WHEN i.item_status='REPLACED' THEN 1 ELSE 0 END) as total_replaced,
        SUM(CASE WHEN i.item_status='REPLACED_OTHER' THEN 1 ELSE 0 END) as total_replaced_other,
        SUM(CASE WHEN i.item_status='REPLACED_NONORI' THEN 1 ELSE 0 END) as total_replaced_nonori,
        COALESCE(SUM(CASE WHEN i.item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED') THEN COALESCE(i.harga_part,0)*COALESCE(i.qty,1)+COALESCE(i.harga_jasa,0) ELSE 0 END),0) as outstanding_value
      FROM service_advice_items i
      JOIN service_advice_headers h ON i.header_id = h.id
      WHERE ${where}
    `).get(...params);

    const statusDist = db.prepare(`
      SELECT h.status_header, COUNT(*) as count FROM service_advice_headers h WHERE ${where} GROUP BY h.status_header
    `).all(...params);

    res.json({ totalVehicles, totalHeaders, ...itemStats, statusDistribution: statusDist });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sa-performance', authenticate, authorize('SUPER_ADMIN', 'SA'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where = '1=1'; let params = [];
    if (date_from) { where += ' AND h.tanggal_input >= ?'; params.push(date_from); }
    if (date_to) { where += " AND h.tanggal_input <= ?"; params.push(date_to + ' 23:59:59'); }

    const data = db.prepare(`
      SELECT s.id, s.nama_sa,
        COUNT(DISTINCT h.id) as total_kendaraan,
        (SELECT COUNT(*) FROM service_advice_items si JOIN service_advice_headers sh ON si.header_id=sh.id WHERE sh.sa_id=s.id AND ${where.replace(/h\./g,'sh.')}) as total_items,
        (SELECT COUNT(*) FROM follow_ups fu JOIN service_advice_items si2 ON fu.item_id=si2.id JOIN service_advice_headers sh2 ON si2.header_id=sh2.id WHERE sh2.sa_id=s.id) as total_followups,
        (SELECT COUNT(*) FROM service_advice_items si3 JOIN service_advice_headers sh3 ON si3.header_id=sh3.id WHERE sh3.sa_id=s.id AND si3.item_status NOT IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED','REJECTED')) as total_outstanding,
        (SELECT COUNT(*) FROM service_advice_items si4 JOIN service_advice_headers sh4 ON si4.header_id=sh4.id WHERE sh4.sa_id=s.id AND si4.item_status IN ('REPLACED','REPLACED_OTHER','REPLACED_NONORI','CLOSED')) as total_closed
      FROM master_sa s
      LEFT JOIN service_advice_headers h ON h.sa_id = s.id AND ${where}
      WHERE s.is_active = 1
      GROUP BY s.id ORDER BY s.nama_sa
    `).all(...params);

    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/operational', authenticate, (req, res) => {
  try {
    const partmanPending = db.prepare("SELECT COUNT(*) as c FROM service_advice_items WHERE item_status = 'WAITING_PARTMAN'").get().c;
    const saPending = db.prepare("SELECT COUNT(*) as c FROM service_advice_items WHERE item_status = 'WAITING_SA_PRICING'").get().c;
    const needFollowUp = db.prepare("SELECT COUNT(*) as c FROM service_advice_items WHERE item_status = 'READY_FOLLOWUP'").get().c;
    const needReminder = db.prepare("SELECT COUNT(*) as c FROM service_advice_items WHERE item_status IN ('FOLLOWED_UP','WAITING_DECISION','APPROVED','DEFERRED')").get().c;
    const noProof = db.prepare(`
      SELECT COUNT(DISTINCT i.id) as c FROM service_advice_items i
      WHERE i.item_status IN ('FOLLOWED_UP','WAITING_DECISION','APPROVED')
      AND i.id NOT IN (SELECT a.entity_id FROM attachments a WHERE a.entity_type = 'FOLLOW_UP_PROOF')
    `).get().c;

    res.json({ partmanPending, saPending, needFollowUp, needReminder, noProof });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
