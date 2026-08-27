const { searchRainforestStrict } = require('../services/rainforestStrictSearch');

function blockThirdPartyAmazonReviews(req, res, next) {
  const path = String(req.originalUrl || req.url || '');
  const isReviewSync = req.method === 'POST' && (
    /\/api\/functions\/rainforest-reviews(?:\?|$)/.test(path) ||
    /\/api\/deals\/[^/]+\/sync-reviews(?:\?|$)/.test(path)
  );
  if (!isReviewSync) return next();

  return res.status(410).json({
    error: 'Amazon customer review syncing is disabled until DealScout uses an authorized Amazon content source.',
    code: 'AMAZON_REVIEW_CONTENT_DISABLED',
  });
}

async function strictRainforestSearch(req, res, next) {
  const path = String(req.originalUrl || req.url || '');
  if (req.method !== 'POST' || !/\/api\/functions\/rainforest-search(?:\?|$)/.test(path)) return next();

  try {
    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ error: 'Search query is required.' });
    const result = await searchRainforestStrict(query, {
      amazonDomain: req.body?.amazonDomain || 'amazon.com',
      maxResults: Number(req.body?.maxResults) || 10,
      page: Number(req.body?.page) || 1,
      sortBy: req.body?.sortBy || 'featured',
    });
    return res.json(result);
  } catch (err) {
    console.warn('[strictRainforestSearch] search failed:', err.message);
    return res.status(503).json({ error: err.message || 'Rainforest search is unavailable.' });
  }
}

module.exports = { blockThirdPartyAmazonReviews, strictRainforestSearch };
