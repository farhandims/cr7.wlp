-- CR7 WebApp Database Schema
-- SQLite Database

-- ==========================================
-- MASTER TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS master_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT NOT NULL,
  role_code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS master_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (role_id) REFERENCES master_roles(id)
);

CREATE TABLE IF NOT EXISTS master_teknisi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_teknisi TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS master_sa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_sa TEXT NOT NULL,
  user_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES master_users(id)
);

CREATE TABLE IF NOT EXISTS master_foreman (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_foreman TEXT NOT NULL,
  user_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES master_users(id)
);

-- ==========================================
-- KATEGORI SERVICE
-- ==========================================

CREATE TABLE IF NOT EXISTS master_kategori_service (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_kategori TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Seed default categories
INSERT OR IGNORE INTO master_kategori_service (nama_kategori) VALUES ('SERVICE BERKALA');
INSERT OR IGNORE INTO master_kategori_service (nama_kategori) VALUES ('KENYAMANAN');
INSERT OR IGNORE INTO master_kategori_service (nama_kategori) VALUES ('KESELAMATAN');
INSERT OR IGNORE INTO master_kategori_service (nama_kategori) VALUES ('ATURAN LALU LINTAS');

-- ==========================================
-- CABANG (Branch)
-- ==========================================

CREATE TABLE IF NOT EXISTS master_cabang (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_cabang TEXT NOT NULL,
  alamat TEXT,
  telepon TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ==========================================
-- TRANSACTION TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS kendaraan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no_polisi TEXT NOT NULL,
  no_rangka TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS service_advice_headers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kendaraan_id INTEGER NOT NULL,
  nomor_dokumen TEXT NOT NULL UNIQUE,
  status_header TEXT NOT NULL DEFAULT 'DRAFT',
  teknisi_id INTEGER NOT NULL,
  sa_id INTEGER NOT NULL,
  tanggal_input TEXT DEFAULT (datetime('now', 'localtime')),
  foreman_validated INTEGER DEFAULT 0,
  foreman_id INTEGER,
  validated_at TEXT,
  validation_note TEXT,
  note TEXT,
  created_by INTEGER NOT NULL,
  updated_by INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (kendaraan_id) REFERENCES kendaraan(id),
  FOREIGN KEY (teknisi_id) REFERENCES master_teknisi(id),
  FOREIGN KEY (sa_id) REFERENCES master_sa(id),
  FOREIGN KEY (foreman_id) REFERENCES master_foreman(id),
  FOREIGN KEY (created_by) REFERENCES master_users(id),
  FOREIGN KEY (updated_by) REFERENCES master_users(id)
);

CREATE TABLE IF NOT EXISTS service_advice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  header_id INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('PART', 'JASA')),
  item_name TEXT NOT NULL,
  item_description TEXT,
  qty INTEGER DEFAULT 1,
  no_part TEXT,
  harga_part REAL DEFAULT 0,
  harga_jasa REAL DEFAULT 0,
  part_availability TEXT,
  item_status TEXT NOT NULL DEFAULT 'NEW',
  customer_decision TEXT,
  replacement_status TEXT,
  replacement_date TEXT,
  replacement_note TEXT,
  completed_by INTEGER,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (header_id) REFERENCES service_advice_headers(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES master_users(id)
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  follow_up_date TEXT NOT NULL,
  follow_up_by INTEGER NOT NULL,
  follow_up_result TEXT,
  next_follow_up_date TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (item_id) REFERENCES service_advice_items(id) ON DELETE CASCADE,
  FOREIGN KEY (follow_up_by) REFERENCES master_users(id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  reminder_date TEXT NOT NULL,
  reminder_by INTEGER NOT NULL,
  reminder_result TEXT,
  next_reminder_date TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (item_id) REFERENCES service_advice_items(id) ON DELETE CASCADE,
  FOREIGN KEY (reminder_by) REFERENCES master_users(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by INTEGER NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (uploaded_by) REFERENCES master_users(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  action_by INTEGER NOT NULL,
  action_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (action_by) REFERENCES master_users(id)
);

-- ==========================================
-- MIGRATION: Add kategori_id to items (safe for existing DB)
-- ==========================================
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we handle it in code (database.js)

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_kendaraan_no_polisi ON kendaraan(no_polisi);
CREATE INDEX IF NOT EXISTS idx_kendaraan_no_rangka ON kendaraan(no_rangka);
CREATE INDEX IF NOT EXISTS idx_sah_kendaraan_id ON service_advice_headers(kendaraan_id);
CREATE INDEX IF NOT EXISTS idx_sah_status ON service_advice_headers(status_header);
CREATE INDEX IF NOT EXISTS idx_sah_sa_id ON service_advice_headers(sa_id);
CREATE INDEX IF NOT EXISTS idx_sah_teknisi_id ON service_advice_headers(teknisi_id);
CREATE INDEX IF NOT EXISTS idx_sah_nomor_dok ON service_advice_headers(nomor_dokumen);
CREATE INDEX IF NOT EXISTS idx_sai_header_id ON service_advice_items(header_id);
CREATE INDEX IF NOT EXISTS idx_sai_status ON service_advice_items(item_status);
CREATE INDEX IF NOT EXISTS idx_sai_type ON service_advice_items(item_type);
CREATE INDEX IF NOT EXISTS idx_followups_item_id ON follow_ups(item_id);
CREATE INDEX IF NOT EXISTS idx_reminders_item_id ON reminders(item_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_action_at ON activity_logs(action_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON master_users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON master_users(is_active);
