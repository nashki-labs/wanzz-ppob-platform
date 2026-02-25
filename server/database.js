const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// (Moved above for dotenv)

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'wanzz.db');

// Pastikan folder data ada
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================
// SCHEMA INITIALIZATION
// ============================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    balance REAL DEFAULT 0,
    photo_url TEXT,
    api_key TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_email TEXT,
    product_code TEXT,
    product_name TEXT,
    target TEXT,
    price REAL,
    status TEXT DEFAULT 'pending',
    reff_id TEXT,
    vendor_id TEXT,
    gateway_response TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    reff_id TEXT,
    nominal REAL,
    fee REAL DEFAULT 0,
    method TEXT,
    status TEXT DEFAULT 'pending',
    qr_image_url TEXT,
    payment_number TEXT,
    total_payment REAL,
    vendor_id TEXT,
    gateway_response TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    expired_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Initial settings
  INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_mode', 'false');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('active_deposit_method', 'ciaatopup');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('profit_percent', '5');

  -- Initial Pterodactyl dynamic packages
  INSERT OR IGNORE INTO settings (key, value) VALUES ('ptero_packages', '{
    \"1gb\":  {\"memo\": 1024,  \"cpu\": 30,  \"disk\": 1024,  \"price\": 5000,  \"label\": \"1 GB\"},
    \"2gb\":  {\"memo\": 2048,  \"cpu\": 60,  \"disk\": 2048,  \"price\": 8000,  \"label\": \"2 GB\"},
    \"3gb\":  {\"memo\": 3072,  \"cpu\": 90,  \"disk\": 3072,  \"price\": 12000, \"label\": \"3 GB\"},
    \"4gb\":  {\"memo\": 4096,  \"cpu\": 120, \"disk\": 4096,  \"price\": 15000, \"label\": \"4 GB\"},
    \"5gb\":  {\"memo\": 5120,  \"cpu\": 150, \"disk\": 5120,  \"price\": 18000, \"label\": \"5 GB\"},
    \"6gb\":  {\"memo\": 6144,  \"cpu\": 180, \"disk\": 6144,  \"price\": 22000, \"label\": \"6 GB\"},
    \"7gb\":  {\"memo\": 7168,  \"cpu\": 210, \"disk\": 7168,  \"price\": 25000, \"label\": \"7 GB\"},
    \"8gb\":  {\"memo\": 8192,  \"cpu\": 240, \"disk\": 8192,  \"price\": 28000, \"label\": \"8 GB\"},
    \"9gb\":  {\"memo\": 9216,  \"cpu\": 270, \"disk\": 9216,  \"price\": 32000, \"label\": \"9 GB\"},
    \"10gb\": {\"memo\": 10240, \"cpu\": 300, \"disk\": 10240, \"price\": 35000, \"label\": \"10 GB\"},
    \"unli\": {\"memo\": 0,     \"cpu\": 0,   \"disk\": 0,     \"price\": 50000, \"label\": \"Unlimited\"}
  }');

  -- Performance Indexes
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_reff_id ON transactions(reff_id);
  CREATE INDEX IF NOT EXISTS idx_deposits_reff_id ON deposits(reff_id);
  CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sender TEXT CHECK(sender IN ('user', 'admin')),
    text TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pterodactyl_panels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    package_id TEXT NOT NULL,
    panel_username TEXT,
    panel_email TEXT,
    panel_password TEXT,
    ptero_user_id INTEGER,
    ptero_server_id INTEGER,
    egg_id INTEGER,
    egg_name TEXT,
    server_name TEXT,
    memory INTEGER,
    disk INTEGER,
    cpu INTEGER,
    price REAL,
    status TEXT DEFAULT 'pending',
    domain TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// --- Migrations (Defensive) ---
try {
  db.prepare("ALTER TABLE deposits ADD COLUMN payment_number TEXT").run();
} catch (e) { }
try {
  db.prepare("ALTER TABLE deposits ADD COLUMN total_payment REAL").run();
} catch (e) { }


// ============================
// SEED ADMIN USER
// ============================
function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('⚠️ [DB] ADMIN_EMAIL or ADMIN_PASSWORD not set in .env. Skipping admin seeding.');
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existing) {
    const adminId = crypto.randomUUID();
    const adminApiKey = `wanzz-admin-${crypto.randomBytes(24).toString('hex')}`;
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, balance, photo_url, api_key)
      VALUES (?, ?, ?, ?, 'admin', 0, ?, ?)
    `).run(
      adminId,
      'Super Admin',
      adminEmail,
      hash,
      `https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff`,
      adminApiKey
    );
    console.log(`🔑 [DB] Admin user seeded: ${adminEmail}`);
  }
}

seedAdmin();

// ============================
// HELPER FUNCTIONS
// ============================

// --- USERS ---
export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function createUser({ id, name, email, phone, passwordHash, photoUrl, apiKey }) {
  return db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, balance, photo_url, api_key)
    VALUES (?, ?, ?, ?, ?, 'user', 0, ?, ?)
  `).run(id, name, email, phone, passwordHash, photoUrl, apiKey);
}

export function updateUser(id, { name, email, phone, passwordHash }) {
  const updates = [];
  const params = [];

  if (name) { updates.push('name = ?'); params.push(name); }
  if (email) { updates.push('email = ?'); params.push(email); }
  if (phone) { updates.push('phone = ?'); params.push(phone); }
  if (passwordHash) { updates.push('password_hash = ?'); params.push(passwordHash); }

  if (updates.length === 0) return { changes: 0 };

  params.push(id);
  return db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

export function getUserBalance(userId) {
  const row = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  return row ? row.balance : 0;
}

export function deductBalance(userId, amount) {
  return db.prepare('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?').run(amount, userId, amount);
}

export function addBalance(userId, amount) {
  return db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
}

export function getAllUsers() {
  return db.prepare('SELECT id, name, email, phone, role, balance, photo_url, api_key, created_at FROM users').all();
}

// --- TRANSACTIONS ---
export function createTransaction({ id, userId, userName, userEmail, productCode, productName, target, price, status, reffId, vendorId, gatewayResponse }) {
  return db.prepare(`
    INSERT INTO transactions (id, user_id, user_name, user_email, product_code, product_name, target, price, status, reff_id, vendor_id, gateway_response)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, userName, userEmail, productCode, productName, target, price, status, reffId, vendorId, gatewayResponse);
}

export function getAllTransactions() {
  return db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all();
}

export function updateTransactionStatus(id, status, gatewayResponse) {
  return db.prepare('UPDATE transactions SET status = ?, gateway_response = ? WHERE id = ?').run(status, gatewayResponse, id);
}

export function findTransactionById(id) {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
}

// --- DEPOSITS ---
export function createDepositRecord({ id, userId, userName, reffId, nominal, fee, method, status, qrImageUrl, paymentNumber, vendorId, gatewayResponse, expiredAt }) {
  return db.prepare(`
    INSERT INTO deposits (id, user_id, user_name, reff_id, nominal, fee, method, status, qr_image_url, payment_number, vendor_id, gateway_response, expired_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, userName, reffId, nominal, fee, method, status, qrImageUrl, paymentNumber, vendorId, gatewayResponse, expiredAt);
}

export function getAllDeposits() {
  return db.prepare('SELECT * FROM deposits ORDER BY created_at DESC').all();
}

export function findDepositById(id) {
  return db.prepare('SELECT * FROM deposits WHERE id = ?').get(id);
}

export function updateDepositStatus(id, status, gatewayResponse) {
  return db.prepare('UPDATE deposits SET status = ?, gateway_response = ? WHERE id = ?').run(status, gatewayResponse, id);
}

export function updateDepositRecord({ id, method, status, qrImageUrl, paymentNumber, gatewayResponse, expiredAt, totalPayment }) {
  return db.prepare(`
    UPDATE deposits 
    SET method = ?, status = ?, qr_image_url = ?, payment_number = ?, gateway_response = ?, expired_at = ?, total_payment = ?
    WHERE id = ?
  `).run(method, status, qrImageUrl, paymentNumber, gatewayResponse, expiredAt, totalPayment, id);
}

// --- SETTINGS ---
export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// --- MESSAGES ---
export function createMessage({ id, userId, sender, text }) {
  return db.prepare(`
    INSERT INTO messages (id, user_id, sender, text)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, sender, text);
}

export function getUserMessages(userId) {
  return db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp ASC').all(userId);
}

// Atomic transaction helper
export function runInTransaction(fn) {
  const transaction = db.transaction(fn);
  return transaction();
}

export default db;
