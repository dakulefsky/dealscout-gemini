const { getIntegrityHealth } = require('../services/integrityHealthService');
const { requireAdmin } = require('./auth');

function integrityHealthEndpoint(req, res, next) {
  if (req.method !== 'GET' || req.path !== '/integrity-health') return next();
  return requireAdmin(req, res, async () => {
    try {
      res.json(await getIntegrityHealth());
    } catch (error) {
      res.status(500).json({ error: error.message || 'Integrity health check failed' });
    }
  });
}

module.exports = { integrityHealthEndpoint };
