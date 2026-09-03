const dealRepository = require('./dealRepository');
const postgres = require('../storage/postgres');
const { PUBLIC_PRICE_MAX_AGE_SECONDS, isPublicDeal, freshPriceThreshold } = require('../services/publicDealPolicy');

async function listFreshPublicDeals({ maxAgeHours = PUBLIC_PRICE_MAX_AGE_SECONDS / 3600, nowUnix = Math.floor(Date.now() / 1000) } = {}) {
  const requestedMaxAgeSeconds = Math.max(0, Number(maxAgeHours) || 0) * 3600;
  const maxAgeSeconds = Math.min(requestedMaxAgeSeconds, PUBLIC_PRICE_MAX_AGE_SECONDS);
  const threshold = freshPriceThreshold(nowUnix, maxAgeSeconds);
  if (!postgres.isConfigured()) {
    return (await dealRepository.listAll()).filter((deal) => isPublicDeal(deal, { nowSeconds: nowUnix, maxAgeSeconds }));
  }

  await dealRepository.ensureSchema();
  const result = await postgres.query(`
    SELECT id, asin, price_check_at
      FROM deals
     WHERE status = 'APPROVED'
       AND source_verified = 1
       AND is_expired <> 1
       AND original_price > 0
       AND sale_price > 0
       AND sale_price < original_price
       AND price_check_at IS NOT NULL
       AND price_check_at >= $1
       AND price_check_at <= $2
     ORDER BY price_check_at DESC, id DESC
  `, [threshold, Number(nowUnix)]);
  return result.rows;
}

module.exports = { listFreshPublicDeals };
