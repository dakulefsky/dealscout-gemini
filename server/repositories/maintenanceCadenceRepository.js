const postgres = require('../storage/postgres');

const fallback = new Map();
let schemaReady = false;

function cleanKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(key)) throw new Error('Invalid maintenance job key');
  return key;
}

function positiveSeconds(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS maintenance_job_state (
      job_key TEXT PRIMARY KEY,
      last_claimed_at BIGINT,
      next_due_at BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await postgres.query('CREATE INDEX IF NOT EXISTS idx_maintenance_job_state_due ON maintenance_job_state(next_due_at)');
  schemaReady = true;
}

async function claim(jobKeyValue, intervalSecondsValue, { force = false, nowUnix = Math.floor(Date.now() / 1000) } = {}) {
  const jobKey = cleanKey(jobKeyValue);
  const intervalSeconds = positiveSeconds(intervalSecondsValue, 60);
  const now = Math.floor(Number(nowUnix));
  const nextDueAt = now + intervalSeconds;

  if (!postgres.isConfigured()) {
    const current = fallback.get(jobKey);
    if (!force && current && Number(current.next_due_at || 0) > now) return { acquired: false, state: { ...current } };
    const state = { job_key: jobKey, last_claimed_at: now, next_due_at: nextDueAt };
    fallback.set(jobKey, state);
    return { acquired: true, state: { ...state } };
  }

  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO maintenance_job_state(job_key, last_claimed_at, next_due_at, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (job_key) DO UPDATE SET
      last_claimed_at = EXCLUDED.last_claimed_at,
      next_due_at = EXCLUDED.next_due_at,
      updated_at = NOW()
    WHERE $4::boolean = TRUE OR maintenance_job_state.next_due_at <= $2
    RETURNING *
  `, [jobKey, now, nextDueAt, Boolean(force)]);

  if (result.rowCount > 0) return { acquired: true, state: result.rows[0] };
  const existing = await postgres.query('SELECT * FROM maintenance_job_state WHERE job_key = $1 LIMIT 1', [jobKey]);
  return { acquired: false, state: existing.rows[0] || null };
}

async function reschedule(jobKeyValue, nextDueAtValue, { nowUnix = Math.floor(Date.now() / 1000) } = {}) {
  const jobKey = cleanKey(jobKeyValue);
  const now = Math.floor(Number(nowUnix));
  const requested = Math.floor(Number(nextDueAtValue));
  const nextDueAt = Number.isFinite(requested) ? Math.max(now + 1, requested) : now + 60;

  if (!postgres.isConfigured()) {
    const current = fallback.get(jobKey) || { job_key: jobKey, last_claimed_at: now };
    const state = { ...current, next_due_at: nextDueAt };
    fallback.set(jobKey, state);
    return { ...state };
  }

  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO maintenance_job_state(job_key, last_claimed_at, next_due_at, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (job_key) DO UPDATE SET
      next_due_at = EXCLUDED.next_due_at,
      updated_at = NOW()
    RETURNING *
  `, [jobKey, now, nextDueAt]);
  return result.rows[0] || null;
}

async function get(jobKeyValue) {
  const jobKey = cleanKey(jobKeyValue);
  if (!postgres.isConfigured()) return fallback.get(jobKey) || null;
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM maintenance_job_state WHERE job_key = $1 LIMIT 1', [jobKey]);
  return result.rows[0] || null;
}

function resetFallback() { fallback.clear(); }

module.exports = { ensureSchema, claim, reschedule, get, cleanKey, resetFallback };
