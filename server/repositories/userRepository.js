const db = require('../db');
const postgres = require('../storage/postgres');

let schemaReady = false;

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

  const count = await postgres.query('SELECT COUNT(*)::int AS count FROM users');
  if (count.rows[0].count === 0 && Array.isArray(db.tables.users) && db.tables.users.length) {
    for (const user of db.tables.users) {
      await postgres.query(
        `INSERT INTO users (id, email, password, role, verified, otp_code, otp_expires, reset_token, reset_expires, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          user.id,
          String(user.email || '').toLowerCase(),
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
  const normalized = String(email || '').trim().toLowerCase();
  if (!postgres.isConfigured()) return clone((db.tables.users || []).find((u) => String(u.email || '').toLowerCase() === normalized));
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
    email: String(user.email || '').trim().toLowerCase(),
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

module.exports = { ensureSchema, findById, findByEmail, findByResetToken, create, updateFields };
