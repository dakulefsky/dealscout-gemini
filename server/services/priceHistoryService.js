const { processPriceAlerts } = require('./priceAlertService');

function normalizeAsin(value) {
  const asin = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(asin) ? asin : null;
}

async function safelyProcessPriceAlerts(observation) {
  try { return await processPriceAlerts(observation); }
  catch (err) {
    console.warn('[PriceObservation] Price alert processing skipped:', err.message);
    return null;
  }
}

async function recordObservation({ asin, salePrice, originalPrice }) {
  const cleanAsin = normalizeAsin(asin);
  const sale = Number(salePrice);
  const original = Number(originalPrice);
  if (!cleanAsin || !Number.isFinite(sale) || sale <= 0 || !Number.isFinite(original) || original <= 0 || sale > original) return false;
  await safelyProcessPriceAlerts({ asin: cleanAsin, salePrice: sale });
  return true;
}

module.exports = { recordObservation, normalizeAsin, safelyProcessPriceAlerts };
