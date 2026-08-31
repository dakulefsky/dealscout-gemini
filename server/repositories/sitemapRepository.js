const dealRepository = require('./dealRepository');
const postgres = require('../storage/postgres');

async function listFreshPublicDeals({ maxAgeHours = 168, nowUnix = Math.floor(Date.now() / 1000) } = {}) {
  const threshold = Number(nowUnix) - Math.max(0, Number(maxAgeHours) || 0) * 3600;
  if (!postgres.isConfigured()) {
    return (await dealRepository.listAll()).filter((deal) => (
      deal.status === 'APPROVED'
      && deal.source_verified === 1
      && deal.is_expired !== 1
      && Number(deal.price_check_at || 0) >= threshold
    ));
  }

  await dealRepository.ensureSchema();
  const result = await postgres.query(`
    SELECT id, asin, price_check_at
      FROM deals
     WHERE status = 'APPROVED'
       AND source_verified = 1
       AND is_expired <> 1
       AND price_check_at IS NOT NULL
       AND price_check_at >= $1
     ORDER BY price_check_at DESC, id DESC
  `, [threshold]);
  return result.rows;
}

module.exports = { listFreshPublicDeals };
