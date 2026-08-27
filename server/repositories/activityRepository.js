const postgres = require('../storage/postgres');

let schemaReady = false;
const memory = [];

function nowUnix() { return Math.floor(Date.now() / 1000); }

function normalize(input = {}) {
  const action = String(input.action || '').trim().slice(0, 120);
  if (!action) throw new Error('Activity action is required');
  return {
    id: String(input.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
    action,
    target_type: String(input.targetType || input.target_type || '').trim().slice(0, 80) || null,
    target_id: String(input.targetId || input.target_id || '').trim().slice(0, 200) || null,
    actor: String(input.actor || '').trim().slice(0, 200) || null,
    method: String(input.method || '').trim().toUpperCase().slice(0, 12) || null,
    path: String(input.path || '').trim().slice(0, 300) || null,
    created_at: Number(input.createdAt || input.created_at || nowUnix()),
  };
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS admin_activity (
      id VARCHAR(80) PRIMARY KEY,
      action VARCHAR(120) NOT NULL,
      target_type VARCHAR(80),
      target_id TEXT,
      actor TEXT,
      method VARCHAR(12),
      path TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity (created_at DESC);
  `);
  schemaReady = true;
}

async function append(input) {
  const row = normalize(input);
  if (!postgres.isConfigured()) {
    memory.unshift(row);
    if (memory.length > 500) memory.length = 500;
    return row;
  }
  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO admin_activity (id, action, target_type, target_id, actor, method, path, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *`,
    [row.id, row.action, row.target_type, row.target_id, row.actor, row.method, row.path, row.created_at]
  );
  return result.rows[0];
}

async function listRecent(limit = 20) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  if (!postgres.isConfigured()) return memory.slice(0, safeLimit);
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT $1', [safeLimit]);
  return result.rows;
}

module.exports = { ensureSchema, append, listRecent, normalize };
