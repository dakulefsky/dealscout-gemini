const { Pool } = require('pg');

let pool = null;

function cloudSqlConnectionName() {
  return String(process.env.CLOUD_SQL_CONNECTION_NAME || '').trim();
}

function hasCloudSqlConfig() {
  return Boolean(
    cloudSqlConnectionName()
    && String(process.env.DB_USER || '').trim()
    && process.env.DB_PASSWORD
    && String(process.env.DB_NAME || '').trim()
  );
}

function isConfigured() {
  return hasCloudSqlConfig() || Boolean(process.env.DATABASE_URL);
}

function getPoolConfig() {
  if (hasCloudSqlConfig()) {
    return {
      host: `/cloudsql/${cloudSqlConnectionName()}`,
      user: String(process.env.DB_USER).trim(),
      password: process.env.DB_PASSWORD,
      database: String(process.env.DB_NAME).trim(),
      max: Number(process.env.PG_POOL_MAX || 5),
      ssl: false,
    };
  }

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX || 5),
    };
  }

  return null;
}

function getPool() {
  if (!isConfigured()) return null;
  if (!pool) {
    pool = new Pool(getPoolConfig());
    pool.on('error', (err) => console.error('[Postgres] Idle client error:', err.message));
  }
  return pool;
}

async function query(text, params) {
  const client = getPool();
  if (!client) throw new Error('PostgreSQL is not configured');
  return client.query(text, params);
}

/**
 * Execute a task while holding a session-scoped PostgreSQL advisory lock.
 * A dedicated pool client is required because advisory locks belong to a DB
 * session, not to an individual query. Local JSON development has only one
 * process, so it executes directly and reports the lock as acquired.
 */
async function withAdvisoryLock(lockId, task) {
  if (typeof task !== 'function') throw new TypeError('withAdvisoryLock requires a task function');
  if (!isConfigured()) return { acquired: true, result: await task() };

  const numericLockId = Number(lockId);
  if (!Number.isSafeInteger(numericLockId)) throw new TypeError('Advisory lock id must be a safe integer');

  const client = await getPool().connect();
  let acquired = false;
  try {
    const lockResult = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [numericLockId]);
    acquired = lockResult.rows[0]?.acquired === true;
    if (!acquired) return { acquired: false, result: null };
    return { acquired: true, result: await task() };
  } finally {
    if (acquired) {
      try { await client.query('SELECT pg_advisory_unlock($1)', [numericLockId]); }
      catch (err) { console.error('[Postgres] Failed to release advisory lock:', err.message); }
    }
    client.release();
  }
}

async function health() {
  if (!isConfigured()) return { configured: false, healthy: false };
  try {
    await query('SELECT 1');
    return { configured: true, healthy: true };
  } catch (err) {
    return { configured: true, healthy: false, error: err.message };
  }
}

module.exports = { isConfigured, getPoolConfig, getPool, query, withAdvisoryLock, health };
