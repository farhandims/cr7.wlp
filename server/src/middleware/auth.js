const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'cr7-webapp-secret';

// Verify JWT token middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, r.role_code, r.role_name
      FROM master_users u
      JOIN master_roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesi telah berakhir. Silakan login ulang.' });
    }
    return res.status(401).json({ error: 'Token tidak valid.' });
  }
}

// Role-based access control middleware
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Tidak terautentikasi.' });
    }
    if (!allowedRoles.includes(req.user.role_code)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, JWT_SECRET };
