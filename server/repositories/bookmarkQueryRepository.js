const postgres = require('../storage/postgres');
const bookmarkRepository = require('./bookmarkRepository');
const dealRepository = require('./dealRepository');

function isPublicDeal(deal) {
  return deal && deal.status === 'APPROVED' && deal.source_verified === 1 && deal.is_expired !== 1;
}

async function listPublicSavedDeals(userId) {
  if (!postgres.isConfigured()) {
    const saved = await bookmarkRepository.listBookmarks(userId);
    const rows = await Promise.all(saved.map(async (bookmark) => {
      const deal = await dealRepository.findByIdOrAsin(bookmark.dealId);
      if (!isPublicDeal(deal)) return null;
      return {
        ...deal,
        bookmark_created_at: bookmark.createdAt || null,
        bookmark_target_price: bookmark.targetPrice ?? null,
      };
    }));
    return rows.filter(Boolean);
  }

  await bookmarkRepository.ensureSchema();
  const result = await postgres.query(`
    SELECT d.*,
           b.created_at AS bookmark_created_at,
           b.target_price AS bookmark_target_price
      FROM bookmarks b
      JOIN deals d ON d.id = b.deal_id
     WHERE b.user_id = $1
       AND d.status = 'APPROVED'
       AND d.source_verified = 1
       AND d.is_expired <> 1
     ORDER BY b.created_at DESC`, [userId]);
  return result.rows;
}

module.exports = { listPublicSavedDeals };
