const { requireAdmin } = require('./auth');
const publicationMetrics = require('../repositories/publicationMetricsRepository');

function publicationHealthEndpoint(req, res, next) {
  if (req.method !== 'GET' || req.path !== '/publication-health') return next();
  return requireAdmin(req, res, async () => {
    try {
      res.json(await publicationMetrics.health());
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unable to load publication health' });
    }
  });
}

module.exports = { publicationHealthEndpoint };
