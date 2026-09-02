const { searchRainforestStrict } = require('../services/rainforestStrictSearch');
const { runProviderCall } = require('../services/providerThrottle');
const { requireAdmin } = require('./auth');

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

  return requireAdmin(req, res, async () => {
    try {
      const query = String(req.body?.query || '').trim();
      if (!query) return res.status(400).json({ error: 'Search query is required.' });
      const result = await runProviderCall('rainforest', () => searchRainforestStrict(query, {
        amazonDomain: req.body?.amazonDomain || 'amazon.com',
        maxResults: Number(req.body?.maxResults) || 10,
        page: Number(req.body?.page) || 1,
        sortBy: req.body?.sortBy || 'featured',
      }));
      return res.json(result);
    } catch (err) {
      console.warn('[strictRainforestSearch] search failed:', err.message);
      if (err?.code === 'PROVIDER_BUDGET_EXCEEDED') {
        return res.status(429).json({ error: 'Rainforest request budget reached.', code: err.code, scope: err.scope, limit: err.limit });
      }
      if (err?.code === 'PROVIDER_COOLDOWN') {
        return res.status(503).json({ error: 'Rainforest is temporarily cooling down.', code: err.code, retryAfterMs: err.retryAfterMs });
      }
      return res.status(503).json({ error: err.message || 'Rainforest search is unavailable.' });
    }
  });
}

module.exports = { blockThirdPartyAmazonReviews, strictRainforestSearch };
