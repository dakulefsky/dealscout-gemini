const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const postgres = require('../storage/postgres');

let schemaReady = false;
function nowUnix() { return Math.floor(Date.now() / 1000); }

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS push_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expo_push_token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_push_devices_user_enabled
      ON push_devices (user_id, enabled, updated_at DESC);
  `);
  schemaReady = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    token: row.expo_push_token,
    platform: row.platform,
    enabled: row.enabled === true || row.enabled === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function upsertDevice({ userId, token, platform }) {
  const timestamp = nowUnix();
  if (!postgres.isConfigured()) {
    const existing = (db.tables.push_devices || []).find((item) => item.expo_push_token === token);
    if (existing) {
      existing.user_id = userId;
      existing.platform = platform;
      existing.enabled = true;
      existing.updated_at = timestamp;
      db.saveDb();
      return mapRow(existing);
    }
    const row = { id: uuidv4(), user_id: userId, expo_push_token: token, platform, enabled: true, created_at: timestamp, updated_at: timestamp };
    db.tables.push_devices.push(row);
    db.saveDb();
    return mapRow(row);
  }

  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO push_devices (id, user_id, expo_push_token, platform, enabled, created_at, updated_at)
    VALUES ($1,$2,$3,$4,TRUE,$5,$5)
    ON CONFLICT (expo_push_token) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          enabled = TRUE,
          updated_at = EXCLUDED.updated_at
    RETURNING *
  `, [uuidv4(), userId, token, platform, timestamp]);
  return mapRow(result.rows[0]);
}

async function disableDevice(userId, token) {
  const timestamp = nowUnix();
  if (!postgres.isConfigured()) {
    const row = (db.tables.push_devices || []).find((item) => item.user_id === userId && item.expo_push_token === token);
    if (!row) return false;
    row.enabled = false;
    row.updated_at = timestamp;
    db.saveDb();
    return true;
  }

  await ensureSchema();
  const result = await postgres.query(
    'UPDATE push_devices SET enabled = FALSE, updated_at = $3 WHERE user_id = $1 AND expo_push_token = $2',
    [userId, token, timestamp]
  );
  return result.rowCount > 0;
}

async function listEnabledForUser(userId) {
  if (!postgres.isConfigured()) {
    return (db.tables.push_devices || []).filter((item) => item.user_id === userId && item.enabled !== false).map(mapRow);
  }
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM push_devices WHERE user_id = $1 AND enabled = TRUE ORDER BY updated_at DESC', [userId]);
  return result.rows.map(mapRow);
}

module.exports = { ensureSchema, upsertDevice, disableDevice, listEnabledForUser };
