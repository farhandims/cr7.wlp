require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'cr7.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

console.log('📦 Seeding database...');

// Roles
const roles = [
  { role_name: 'Super Admin', role_code: 'SUPER_ADMIN' },
  { role_name: 'Teknisi', role_code: 'TEKNISI' },
  { role_name: 'Foreman', role_code: 'FOREMAN' },
  { role_name: 'Partman', role_code: 'PARTMAN' },
  { role_name: 'Service Advisor', role_code: 'SA' },
  { role_name: 'MRA', role_code: 'MRA' },
];

const insertRole = db.prepare('INSERT OR IGNORE INTO master_roles (role_name, role_code) VALUES (?, ?)');
for (const r of roles) insertRole.run(r.role_name, r.role_code);
console.log('✅ Roles seeded');

// Get role IDs
const getRoleId = (code) => db.prepare('SELECT id FROM master_roles WHERE role_code = ?').get(code).id;

// Users
const users = [
  { username: 'admin', password: 'admin123', full_name: 'Administrator', role: 'SUPER_ADMIN' },
  { username: 'teknisi', password: 'teknisi123', full_name: 'Akun Teknisi', role: 'TEKNISI' },
  { username: 'foreman', password: 'foreman123', full_name: 'Akun Foreman', role: 'FOREMAN' },
  { username: 'partman', password: 'partman123', full_name: 'Akun Partman', role: 'PARTMAN' },
  { username: 'sa1', password: 'sa123', full_name: 'Service Advisor 1', role: 'SA' },
  { username: 'sa2', password: 'sa123', full_name: 'Service Advisor 2', role: 'SA' },
  { username: 'mra', password: 'mra123', full_name: 'Akun MRA', role: 'MRA' },
];

const insertUser = db.prepare('INSERT OR IGNORE INTO master_users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)');
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.username, hash, u.full_name, getRoleId(u.role));
}
console.log('✅ Users seeded');

// Get user ID by username
const getUserId = (uname) => {
  const u = db.prepare('SELECT id FROM master_users WHERE username = ?').get(uname);
  return u ? u.id : null;
};

// Master Teknisi
const teknisiList = ['Budi Santoso', 'Agus Setiawan', 'Dedi Kurniawan', 'Rizky Pratama', 'Hendra Wijaya'];
const insertTeknisi = db.prepare('INSERT OR IGNORE INTO master_teknisi (nama_teknisi) VALUES (?)');
for (const t of teknisiList) insertTeknisi.run(t);
console.log('✅ Teknisi seeded');

// Master SA
const insertSA = db.prepare('INSERT OR IGNORE INTO master_sa (nama_sa, user_id) VALUES (?, ?)');
insertSA.run('Service Advisor 1', getUserId('sa1'));
insertSA.run('Service Advisor 2', getUserId('sa2'));
console.log('✅ SA seeded');

// Master Foreman
const insertForeman = db.prepare('INSERT OR IGNORE INTO master_foreman (nama_foreman, user_id) VALUES (?, ?)');
insertForeman.run('Foreman Utama', getUserId('foreman'));
console.log('✅ Foreman seeded');

// Sample vehicle and service advice for demo
const kResult = db.prepare('INSERT INTO kendaraan (no_polisi, no_rangka, model) VALUES (?, ?, ?)').run('B 1234 ABC', 'MHKA1BA2J9K123456', 'Toyota Avanza');
const vehicleId = kResult.lastInsertRowid;

const sa = db.prepare('SELECT id FROM master_sa WHERE nama_sa = ?').get('Service Advisor 1');
const tek = db.prepare('SELECT id FROM master_teknisi WHERE nama_teknisi = ?').get('Budi Santoso');

const hResult = db.prepare(`
  INSERT INTO service_advice_headers (kendaraan_id, nomor_dokumen, status_header, teknisi_id, sa_id, created_by, updated_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(vehicleId, 'SA-20260404-0001', 'IN_PROGRESS', tek.id, sa.id, getUserId('teknisi'), getUserId('teknisi'));
const headerId = hResult.lastInsertRowid;

const sampleItems = [
  { type: 'PART', name: 'Brake Pad Depan', desc: 'Ketebalan sudah tipis, perlu segera diganti', qty: 1, status: 'WAITING_PARTMAN' },
  { type: 'PART', name: 'Filter Oli', desc: 'Sudah kotor, disarankan ganti', qty: 1, status: 'WAITING_PARTMAN' },
  { type: 'JASA', name: 'Tune Up Mesin', desc: 'Mesin perlu tune up berkala', qty: 1, status: 'WAITING_SA_PRICING' },
  { type: 'JASA', name: 'Spooring Balancing', desc: 'Ban tidak rata, perlu spooring', qty: 1, status: 'READY_FOLLOWUP' },
];

const insertItem = db.prepare('INSERT INTO service_advice_items (header_id, item_type, item_name, item_description, qty, item_status) VALUES (?, ?, ?, ?, ?, ?)');
for (const item of sampleItems) {
  insertItem.run(headerId, item.type, item.name, item.desc, item.qty, item.status);
}
console.log('✅ Sample data seeded');

// Activity log for seed
db.prepare("INSERT INTO activity_logs (entity_type, entity_id, action_type, description, action_by) VALUES ('SYSTEM', 0, 'SEED', 'Database initialized with seed data', ?)").run(getUserId('admin'));

console.log('\n🎉 Database seeding complete!');
console.log('📋 Default accounts:');
console.log('   admin / admin123 (Super Admin)');
console.log('   teknisi / teknisi123 (Teknisi)');
console.log('   foreman / foreman123 (Foreman)');
console.log('   partman / partman123 (Partman)');
console.log('   sa1 / sa123 (Service Advisor 1)');
console.log('   sa2 / sa123 (Service Advisor 2)');
console.log('   mra / mra123 (MRA)');

db.close();
