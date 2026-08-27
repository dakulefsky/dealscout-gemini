const { requireAdmin } = require('./auth');
const {
  previewLegacyEnrichmentCleanup,
  cleanupLegacyEnrichment,
} = require('../services/legacyEnrichmentCleanupService');

function legacyEnrichmentCleanupEndpoint(req, res, next) {
  if (req.path !== '/legacy-enrichment-cleanup') return next();

  return requireAdmin(req, res, async () => {
    try {
      if (req.method === 'GET') return res.json(await previewLegacyEnrichmentCleanup());
      if (req.method === 'POST') return res.json({ success: true, ...(await cleanupLegacyEnrichment()) });
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Legacy enrichment cleanup failed' });
    }
  });
}

module.exports = { legacyEnrichmentCleanupEndpoint };
