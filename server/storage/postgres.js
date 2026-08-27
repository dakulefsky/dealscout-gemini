const { Pool } = require('pg');

let pool = null;

function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!isConfigured()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX || 5),
    });
    pool.on('error', (err) => console.error('[Postgres] Idle client error:', err.message));
  }
  return pool;
}

async function query(text, params) {
  const client = getPool();
  if (!client) throw new Error('PostgreSQL is not configured');
  return client.query(text, params);
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

module.exports = { isConfigured, getPool, query, health };
