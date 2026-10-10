const postgres = require('../storage/postgres');

const DEFAULTS = Object.freeze({
  closure_location: 'jerusalem',
  rainforest_department_discovery: '',
  amazon_prime_day_start: '',
  amazon_prime_day_end: '',
});

const local = new Map();
let schemaPromise = null;

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
  if (key === 'amazon_prime_day_start' || key === 'amazon_prime_day_end') {
    const normalized = String(value ?? '').trim();
    if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${key} must be a calendar date in YYYY-MM-DD format`);
    const parsed = normalized ? new Date(`${normalized}T00:00:00.000Z`) : null;
    if (normalized && (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized)) throw new Error(`${key} must be a valid calendar date`);
    return normalized;
  }
  const normalized = String(value ?? '');
  if (key === 'rainforest_department_discovery' && normalized.length > 32768) throw new Error('Discovery state is too large');
  return normalized;
}

async function ensureSchema() {
  if (!postgres.isConfigured()) return;
  if (!schemaPromise) schemaPromise = postgres.query(`
    CREATE TABLE IF NOT EXISTS site_runtime_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(error => {
    // A transient startup failure must allow the next request to retry.
    schemaPromise = null;
    throw error;
  });
  await schemaPromise;
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
  if (clean.startsWith('amazon_prime_day_')) require('./primeDayPolicy').invalidate();
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

function resetLocalSettings() { local.clear(); require('./primeDayPolicy').invalidate(); }

module.exports = { DEFAULTS, get, set, resetLocalSettings };
