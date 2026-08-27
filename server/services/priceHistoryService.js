const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'data', 'price-history.json');
const MAX_POINTS_PER_ASIN = 365;
let history = {};

function load() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) history = parsed;
  } catch (err) {
    console.warn('[PriceHistory] Unable to load history:', err.message);
    history = {};
  }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    const temp = `${HISTORY_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(history, null, 2), 'utf8');
    fs.renameSync(temp, HISTORY_FILE);
  } catch (err) {
    console.error('[PriceHistory] Unable to persist history:', err.message);
  }
}

function normalizeAsin(value) {
  const asin = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(asin) ? asin : null;
}

function recordObservation({ asin, salePrice, originalPrice, sourceProvider, observedAt = Date.now() }) {
  const cleanAsin = normalizeAsin(asin);
  const sale = Number(salePrice);
  const original = Number(originalPrice);
  if (!cleanAsin || !Number.isFinite(sale) || sale <= 0 || !Number.isFinite(original) || original <= 0 || sale > original) return false;

  const list = history[cleanAsin] || [];
  const timestamp = Math.floor(Number(observedAt) / 1000);
  const last = list[list.length - 1];
  if (last && last.salePrice === sale && last.originalPrice === original && timestamp - last.observedAt < 3600) return false;

  list.push({
    observedAt: timestamp,
    salePrice: sale,
    originalPrice: original,
    sourceProvider: sourceProvider || null,
  });
  history[cleanAsin] = list.slice(-MAX_POINTS_PER_ASIN);
  persist();
  return true;
}

function getHistory(asin) {
  const cleanAsin = normalizeAsin(asin);
  if (!cleanAsin) return [];
  return [...(history[cleanAsin] || [])]
    .sort((a, b) => a.observedAt - b.observedAt)
    .map((point) => ({
      date: new Date(point.observedAt * 1000).toISOString(),
      price: point.salePrice,
      listPrice: point.originalPrice,
      sourceProvider: point.sourceProvider,
    }));
}

load();

module.exports = { recordObservation, getHistory };
