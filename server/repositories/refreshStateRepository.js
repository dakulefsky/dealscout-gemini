const postgres = require('../storage/postgres');
const { refreshFailureState } = require('../services/refreshRetryPolicy');

let schemaReady = false;
const fallback = new Map();

function cleanAsin(value) {
  const asin = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('Invalid Amazon ASIN');
  return asin;
}

function truncateMessage(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function errorCode(error) {
  return String(
    error?.code
    || error?.statusCode
    || error?.status
    || error?.response?.status
    || 'REFRESH_FAILED'
  ).slice(0, 80);
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS deal_refresh_state (
      asin VARCHAR(10) PRIMARY KEY,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_error_code TEXT,
      last_error_message TEXT,
      last_failure_at BIGINT,
      next_attempt_at BIGINT,
      quarantined_at BIGINT,
      last_success_at BIGINT,
      last_provider TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_deal_refresh_retry ON deal_refresh_state (next_attempt_at);
  `);
  schemaReady = true;
}

async function get(asinValue) {
  const asin = cleanAsin(asinValue);
  if (!postgres.isConfigured()) return fallback.get(asin) || null;
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM deal_refresh_state WHERE asin = $1 LIMIT 1', [asin]);
  return result.rows[0] || null;
}

async function recordFailure(asinValue, error, { provider = null, at = Math.floor(Date.now() / 1000), policyOptions = {} } = {}) {
  const asin = cleanAsin(asinValue);
  const previous = await get(asin);
  const next = refreshFailureState(previous || {}, at, policyOptions);
  const row = {
    asin,
    failure_count: next.failureCount,
    last_error_code: errorCode(error),
    last_error_message: truncateMessage(error?.message || error),
    last_failure_at: at,
    next_attempt_at: next.nextAttemptAt,
    quarantined_at: next.quarantinedAt,
    last_success_at: previous?.last_success_at || null,
    last_provider: provider || previous?.last_provider || null,
  };

  if (!postgres.isConfigured()) {
    fallback.set(asin, row);
    return { ...row };
  }

  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO deal_refresh_state (
      asin, failure_count, last_error_code, last_error_message, last_failure_at,
      next_attempt_at, quarantined_at, last_success_at, last_provider
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (asin) DO UPDATE SET
      failure_count = EXCLUDED.failure_count,
      last_error_code = EXCLUDED.last_error_code,
      last_error_message = EXCLUDED.last_error_message,
      last_failure_at = EXCLUDED.last_failure_at,
      next_attempt_at = EXCLUDED.next_attempt_at,
      quarantined_at = EXCLUDED.quarantined_at,
      last_provider = EXCLUDED.last_provider
    RETURNING *`,
    [
      row.asin, row.failure_count, row.last_error_code, row.last_error_message,
      row.last_failure_at, row.next_attempt_at, row.quarantined_at,
      row.last_success_at, row.last_provider,
    ]
  );
  return result.rows[0];
}

async function recordSuccess(asinValue, { provider = null, at = Math.floor(Date.now() / 1000) } = {}) {
  const asin = cleanAsin(asinValue);
  const row = {
    asin,
    failure_count: 0,
    last_error_code: null,
    last_error_message: null,
    last_failure_at: null,
    next_attempt_at: null,
    quarantined_at: null,
    last_success_at: at,
    last_provider: provider,
  };

  if (!postgres.isConfigured()) {
    fallback.set(asin, row);
    return { ...row };
  }

  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO deal_refresh_state (
      asin, failure_count, last_error_code, last_error_message, last_failure_at,
      next_attempt_at, quarantined_at, last_success_at, last_provider
    ) VALUES ($1,0,NULL,NULL,NULL,NULL,NULL,$2,$3)
    ON CONFLICT (asin) DO UPDATE SET
      failure_count = 0,
      last_error_code = NULL,
      last_error_message = NULL,
      last_failure_at = NULL,
      next_attempt_at = NULL,
      quarantined_at = NULL,
      last_success_at = EXCLUDED.last_success_at,
      last_provider = EXCLUDED.last_provider
    RETURNING *`,
    [asin, at, provider]
  );
  return result.rows[0];
}

function resetFallback() {
  fallback.clear();
}

module.exports = { ensureSchema, get, recordFailure, recordSuccess, cleanAsin, resetFallback };
