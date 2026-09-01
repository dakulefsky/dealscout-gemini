const fs = require('fs');
const path = require('path');
const postgres = require('../storage/postgres');
const { processPriceAlerts } = require('./priceAlertService');

const HISTORY_FILE = path.join(__dirname, '..', 'data', 'price-history.json');
const MAX_POINTS_PER_ASIN = 365;
let history = {};
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

async function safelyProcessPriceAlerts(observation) {
  try { return await processPriceAlerts(observation); }
  catch (err) {
    console.warn('[PriceHistory] Price alert processing skipped:', err.message);
    return null;
  }
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
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

  let recorded = true;
  if (postgres.isConfigured()) {
    await ensureSchema();
    const recent = await postgres.query(
      `SELECT sale_price, original_price, observed_at
         FROM price_history
        WHERE asin = $1
        ORDER BY observed_at DESC
        LIMIT 1`,
      [cleanAsin]
    );
    const last = recent.rows[0];
    const observedDate = new Date(Number(observedAt));
    const duplicate = last
      && Number(last.sale_price) === sale
      && Number(last.original_price) === original
      && observedDate.getTime() - new Date(last.observed_at).getTime() < 3600000;
    if (!duplicate) {
      await postgres.query(
        `INSERT INTO price_history (asin, sale_price, original_price, source_provider, observed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [cleanAsin, sale, original, sourceProvider || null, observedDate]
      );
    } else {
      recorded = false;
    }
    await safelyProcessPriceAlerts({ asin: cleanAsin, salePrice: sale });
    return recorded;
  }

  const list = history[cleanAsin] || [];
  const timestamp = Math.floor(Number(observedAt) / 1000);
  const last = list[list.length - 1];
  const duplicate = last && last.salePrice === sale && last.originalPrice === original && timestamp - last.observedAt < 3600;
  if (!duplicate) {
    list.push({ observedAt: timestamp, salePrice: sale, originalPrice: original, sourceProvider: sourceProvider || null });
    history[cleanAsin] = list.slice(-MAX_POINTS_PER_ASIN);
    persistJsonFallback();
  } else {
    recorded = false;
  }
  await safelyProcessPriceAlerts({ asin: cleanAsin, salePrice: sale });
  return recorded;
}

async function getHistory(asin) {
  const cleanAsin = normalizeAsin(asin);
  if (!cleanAsin) return [];

  if (postgres.isConfigured()) {
    await ensureSchema();
    const result = await postgres.query(
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
  if (!postgres.isConfigured()) return { backend: 'json', configured: false };
  try {
    await ensureSchema();
    const status = await postgres.health();
    return { backend: 'postgres', ...status };
  } catch (err) {
    return { backend: 'postgres', configured: true, healthy: false, error: err.message };
  }
}

loadJsonFallback();

module.exports = { ensureSchema, recordObservation, getHistory, health };
