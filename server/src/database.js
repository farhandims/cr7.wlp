const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'cr7.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Migration: add kategori_id column if not exists
  try {
    db.prepare('SELECT kategori_id FROM service_advice_items LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE service_advice_items ADD COLUMN kategori_id INTEGER REFERENCES master_kategori_service(id)');
    console.log('✅ Migration: kategori_id column added to service_advice_items');
  }

  // Create index after migration ensures column exists
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_sai_kategori ON service_advice_items(kategori_id)');
  } catch (e) { /* index might already exist */ }

  // Migration: create master_cabang if not exists
  db.exec(`CREATE TABLE IF NOT EXISTS master_cabang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_cabang TEXT NOT NULL,
    alamat TEXT,
    telepon TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);
  // Seed default cabang if empty
  const cabangCount = db.prepare('SELECT COUNT(*) as cnt FROM master_cabang').get();
  if (cabangCount.cnt === 0) {
    db.prepare("INSERT INTO master_cabang (nama_cabang, alamat, telepon) VALUES (?, ?, ?)").run(
      'Wijaya Toyota', 'Alamat cabang', '-'
    );
    console.log('✅ Migration: default cabang seeded');
  }

  console.log('✅ Database initialized successfully');
}

module.exports = { db, initializeDatabase };
