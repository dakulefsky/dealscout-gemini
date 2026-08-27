const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const HISTORY_FILE = path.join(__dirname, '..', 'data', 'price-history.json');
const MAX_POINTS_PER_ASIN = 365;
let history = {};
let pool = null;
let schemaReady = false;

function loadJsonFallback() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) history = parsed;
  } catch (err) {
    console.warn('[PriceHistory] Unable to load JSON fallback:', err.message);
    history = {};
  }
}

function persistJsonFallback() {
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    const temp = `${HISTORY_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(history, null, 2), 'utf8');
    fs.renameSync(temp, HISTORY_FILE);
  } catch (err) {
    console.error('[PriceHistory] Unable to persist JSON fallback:', err.message);
  }
}

function normalizeAsin(value) {
  const asin = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(asin) ? asin : null;
}

function postgresEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!postgresEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX || 5),
    });
  }
  return pool;
}

async function ensureSchema() {
  if (!postgresEnabled() || schemaReady) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS price_history (
      id BIGSERIAL PRIMARY KEY,
      asin VARCHAR(10) NOT NULL,
      sale_price NUMERIC(12,2) NOT NULL,
      original_price NUMERIC(12,2) NOT NULL,
      source_provider TEXT,
      observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_price_history_asin_observed_at
      ON price_history (asin, observed_at DESC);
  `);
  schemaReady = true;
}

async function recordObservation({ asin, salePrice, originalPrice, sourceProvider, observedAt = Date.now() }) {
  const cleanAsin = normalizeAsin(asin);
  const sale = Number(salePrice);
  const original = Number(originalPrice);
  if (!cleanAsin || !Number.isFinite(sale) || sale <= 0 || !Number.isFinite(original) || original <= 0 || sale > original) return false;

  if (postgresEnabled()) {
    await ensureSchema();
    const client = getPool();
    const recent = await client.query(
      `SELECT sale_price, original_price, observed_at
         FROM price_history
        WHERE asin = $1
        ORDER BY observed_at DESC
        LIMIT 1`,
      [cleanAsin]
    );
    const last = recent.rows[0];
    const observedDate = new Date(Number(observedAt));
    if (last && Number(last.sale_price) === sale && Number(last.original_price) === original && observedDate.getTime() - new Date(last.observed_at).getTime() < 3600000) {
      return false;
    }
    await client.query(
      `INSERT INTO price_history (asin, sale_price, original_price, source_provider, observed_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [cleanAsin, sale, original, sourceProvider || null, observedDate]
    );
    return true;
  }

  const list = history[cleanAsin] || [];
  const timestamp = Math.floor(Number(observedAt) / 1000);
  const last = list[list.length - 1];
  if (last && last.salePrice === sale && last.originalPrice === original && timestamp - last.observedAt < 3600) return false;
  list.push({ observedAt: timestamp, salePrice: sale, originalPrice: original, sourceProvider: sourceProvider || null });
  history[cleanAsin] = list.slice(-MAX_POINTS_PER_ASIN);
  persistJsonFallback();
  return true;
}

async function getHistory(asin) {
  const cleanAsin = normalizeAsin(asin);
  if (!cleanAsin) return [];

  if (postgresEnabled()) {
    await ensureSchema();
    const result = await getPool().query(
      `SELECT sale_price, original_price, source_provider, observed_at
         FROM price_history
        WHERE asin = $1
        ORDER BY observed_at ASC
        LIMIT $2`,
      [cleanAsin, MAX_POINTS_PER_ASIN]
    );
    return result.rows.map((point) => ({
      date: new Date(point.observed_at).toISOString(),
      price: Number(point.sale_price),
      listPrice: Number(point.original_price),
      sourceProvider: point.source_provider,
    }));
  }

  return [...(history[cleanAsin] || [])]
    .sort((a, b) => a.observedAt - b.observedAt)
    .map((point) => ({
      date: new Date(point.observedAt * 1000).toISOString(),
      price: point.salePrice,
      listPrice: point.originalPrice,
      sourceProvider: point.sourceProvider,
    }));
}

async function health() {
  if (!postgresEnabled()) return { backend: 'json', configured: false };
  try {
    await ensureSchema();
    await getPool().query('SELECT 1');
    return { backend: 'postgres', configured: true, healthy: true };
  } catch (err) {
    return { backend: 'postgres', configured: true, healthy: false, error: err.message };
  }
}

loadJsonFallback();

module.exports = { recordObservation, getHistory, health };
