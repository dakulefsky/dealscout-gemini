const postgres = require('../storage/postgres');

const DEFAULTS = Object.freeze({
  whatsapp_status: Object.freeze({ enabled: true }),
});

const local = new Map();

function cleanChannel(channel) {
  const value = String(channel || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, value)) throw new Error(`Unsupported channel setting: ${value || 'blank'}`);
  return value;
}

async function ensureSchema() {
  if (!postgres.isConfigured()) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS channel_runtime_settings (
      channel TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function get(channel) {
  const key = cleanChannel(channel);
  const fallback = DEFAULTS[key];
  if (!postgres.isConfigured()) return { channel: key, enabled: local.has(key) ? local.get(key) : fallback.enabled };
  await ensureSchema();
  const result = await postgres.query('SELECT channel, enabled, updated_at FROM channel_runtime_settings WHERE channel = $1', [key]);
  const row = result.rows[0];
  return row ? { channel: key, enabled: row.enabled === true, updatedAt: row.updated_at } : { channel: key, enabled: fallback.enabled, updatedAt: null };
}

async function setEnabled(channel, enabled) {
  const key = cleanChannel(channel);
  const normalized = enabled === true;
  if (!postgres.isConfigured()) {
    local.set(key, normalized);
    return { channel: key, enabled: normalized, updatedAt: new Date().toISOString() };
  }
  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO channel_runtime_settings(channel, enabled, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (channel)
    DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
    RETURNING channel, enabled, updated_at
  `, [key, normalized]);
  const row = result.rows[0];
  return { channel: row.channel, enabled: row.enabled === true, updatedAt: row.updated_at };
}

function resetLocalSettings() {
  local.clear();
}

module.exports = { DEFAULTS, ensureSchema, get, setEnabled, resetLocalSettings };
