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

function getSslConfig() {
  const mode = String(process.env.PGSSL || 'verify-full').trim().toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'require') return { rejectUnauthorized: false };
  if (mode === 'verify-full') return { rejectUnauthorized: true };
  throw new Error("PGSSL must be one of: disable, require, verify-full");
}

function getPoolConfig() {
  // Network failures and pool exhaustion must fail requests rather than leave
  // readiness/startup and shoppers waiting indefinitely across clouds.
  const bounded = (key, fallback, min, max) => {
    const raw = String(process.env[key] || '').trim();
    const value = raw ? Number(raw) : fallback;
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be an integer from ${min} to ${max}`);
    }
    return value;
  };
  const limits = {
    max: bounded('PG_POOL_MAX', 5, 2, 20),
    connectionTimeoutMillis: bounded('PG_CONNECT_TIMEOUT_MS', 10000, 1000, 30000),
    statement_timeout: bounded('PG_STATEMENT_TIMEOUT_MS', 30000, 1000, 120000),
    idleTimeoutMillis: 30000,
  };
  if (hasCloudSqlConfig()) {
    return {
      host: `/cloudsql/${cloudSqlConnectionName()}`,
      user: String(process.env.DB_USER).trim(),
      password: process.env.DB_PASSWORD,
      database: String(process.env.DB_NAME).trim(),
      ...limits,
      ssl: false,
    };
  }

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if ([...url.searchParams.keys()].some((key) => /^ssl/i.test(key))) {
      throw new Error('DATABASE_URL must not override TLS; configure PGSSL and NODE_EXTRA_CA_CERTS instead');
    }
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig(),
      ...limits,
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
    let releaseError;
    if (acquired) {
      try { await client.query('SELECT pg_advisory_unlock($1)', [numericLockId]); }
      catch (err) {
        releaseError = err;
        console.error('[Postgres] Failed to release advisory lock:', err.message);
      }
    }
    // Destroy a session whose lock could not be released. Returning it to the
    // pool can retain a lock and block maintenance on all other instances.
    if (releaseError) client.release(releaseError);
    else client.release();
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

async function closePool() {
  const current = pool;
  pool = null;
  if (!current) return;
  await current.end();
}

module.exports = { isConfigured, getSslConfig, getPoolConfig, getPool, query, withAdvisoryLock, health, closePool };
