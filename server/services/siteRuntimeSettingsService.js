const postgres = require('../storage/postgres');

const DEFAULTS = Object.freeze({
  closure_location: 'jerusalem',
});

const local = new Map();

function cleanKey(key) {
  const value = String(key || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, value)) throw new Error(`Unsupported site runtime setting: ${value || 'blank'}`);
  return value;
}

function normalizeValue(key, value) {
  if (key === 'closure_location') {
    const normalized = String(value || '').trim().toLowerCase();
    if (!['jerusalem', 'new_york'].includes(normalized)) throw new Error('closure_location must be jerusalem or new_york');
    return normalized;
  }
  return String(value ?? '');
}

async function ensureSchema() {
  if (!postgres.isConfigured()) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS site_runtime_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function get(key) {
  const clean = cleanKey(key);
  if (!postgres.isConfigured()) return { key: clean, value: local.get(clean) || DEFAULTS[clean], updatedAt: null };
  await ensureSchema();
  const result = await postgres.query('SELECT setting_key, setting_value, updated_at FROM site_runtime_settings WHERE setting_key = $1', [clean]);
  const row = result.rows[0];
  return row ? { key: row.setting_key, value: row.setting_value, updatedAt: row.updated_at } : { key: clean, value: DEFAULTS[clean], updatedAt: null };
}

async function set(key, value) {
  const clean = cleanKey(key);
  const normalized = normalizeValue(clean, value);
  if (!postgres.isConfigured()) {
    local.set(clean, normalized);
    return { key: clean, value: normalized, updatedAt: new Date().toISOString() };
  }
  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO site_runtime_settings(setting_key, setting_value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (setting_key)
    DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
    RETURNING setting_key, setting_value, updated_at
  `, [clean, normalized]);
  const row = result.rows[0];
  return { key: row.setting_key, value: row.setting_value, updatedAt: row.updated_at };
}

function resetLocalSettings() { local.clear(); }

module.exports = { DEFAULTS, get, set, resetLocalSettings };
