const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const postgres = require('../storage/postgres');

let schemaReady = false;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function bootstrapProductionAdmin() {
  if (process.env.NODE_ENV !== 'production' || !postgres.isConfigured()) return { created: false };

  const existingAdmin = await postgres.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (existingAdmin.rowCount > 0) return { created: false };

  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return { created: false };
  if (!validEmail(email)) throw new Error('ADMIN_EMAIL must be a valid email address when bootstrapping the first admin');
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) {
    throw new Error('ADMIN_PASSWORD must be 12-200 characters when bootstrapping the first admin');
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const existingUser = await postgres.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
  if (existingUser.rowCount > 0) {
    await postgres.query(
      `UPDATE users SET password = $1, role = 'admin', verified = 1,
        otp_code = NULL, otp_expires = NULL, reset_token = NULL, reset_expires = NULL
       WHERE id = $2`,
      [passwordHash, existingUser.rows[0].id]
    );
    return { created: true, promoted: true, email };
  }

  await postgres.query(
    `INSERT INTO users (id, email, password, role, verified, otp_code, otp_expires, reset_token, reset_expires, created_at)
     VALUES ($1,$2,$3,'admin',1,NULL,NULL,NULL,NULL,$4)`,
    [uuidv4(), email, passwordHash, Math.floor(Date.now() / 1000)]
  );
  return { created: true, promoted: false, email };
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      verified INTEGER NOT NULL DEFAULT 0,
      otp_code TEXT,
      otp_expires BIGINT,
      reset_token TEXT,
      reset_expires BIGINT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token);
  `);

  if (process.env.NODE_ENV === 'production') {
    await postgres.query(
      `DELETE FROM users WHERE id = $1 OR email = $2`,
      ['usr-admin-1', 'admin@dealscout.local']
    );
  }

  const count = await postgres.query('SELECT COUNT(*)::int AS count FROM users');
  if (count.rows[0].count === 0 && Array.isArray(db.tables.users) && db.tables.users.length) {
    for (const user of db.tables.users) {
      if (process.env.NODE_ENV === 'production' && (user.id === 'usr-admin-1' || user.email === 'admin@dealscout.local')) continue;
      await postgres.query(
        `INSERT INTO users (id, email, password, role, verified, otp_code, otp_expires, reset_token, reset_expires, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          user.id,
          normalizeEmail(user.email),
          user.password,
          user.role || 'user',
          user.verified ? 1 : 0,
          user.otp_code || null,
          user.otp_expires || null,
          user.reset_token || null,
          user.reset_expires || null,
          user.created_at || Math.floor(Date.now() / 1000),
        ]
      );
    }
  }

  await bootstrapProductionAdmin();
  schemaReady = true;
}

function clone(user) {
  return user ? { ...user } : null;
}

async function findById(id) {
  if (!postgres.isConfigured()) return clone((db.tables.users || []).find((u) => u.id === id));
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!postgres.isConfigured()) return clone((db.tables.users || []).find((u) => normalizeEmail(u.email) === normalized));
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalized]);
  return result.rows[0] || null;
}

async function findByResetToken(resetToken) {
  if (!postgres.isConfigured()) return clone((db.tables.users || []).find((u) => u.reset_token === resetToken));
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM users WHERE reset_token = $1 LIMIT 1', [resetToken]);
  return result.rows[0] || null;
}

async function create(user) {
  const record = {
    ...user,
    email: normalizeEmail(user.email),
    role: user.role || 'user',
    verified: user.verified ? 1 : 0,
    created_at: user.created_at || Math.floor(Date.now() / 1000),
  };
  if (!postgres.isConfigured()) {
    db.tables.users.push(record);
    db.saveDb();
    return clone(record);
  }
  await ensureSchema();
  const result = await postgres.query(
    `INSERT INTO users (id, email, password, role, verified, otp_code, otp_expires, reset_token, reset_expires, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [record.id, record.email, record.password, record.role, record.verified, record.otp_code || null, record.otp_expires || null, record.reset_token || null, record.reset_expires || null, record.created_at]
  );
  return result.rows[0];
}

async function updateFields(id, fields) {
  const allowed = ['verified', 'otp_code', 'otp_expires', 'reset_token', 'reset_expires', 'password', 'role'];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  if (!entries.length) return findById(id);

  if (!postgres.isConfigured()) {
    const user = (db.tables.users || []).find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, Object.fromEntries(entries));
    db.saveDb();
    return clone(user);
  }

  await ensureSchema();
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(id);
  const result = await postgres.query(
    `UPDATE users SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

module.exports = { ensureSchema, bootstrapProductionAdmin, findById, findByEmail, findByResetToken, create, updateFields };
