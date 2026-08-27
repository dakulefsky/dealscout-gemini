const { requireAdmin } = require('./auth');
const activity = require('../repositories/activityRepository');

function adminActivityEndpoint(req, res, next) {
  if (req.method !== 'GET' || req.path !== '/admin-activity') return next();
  return requireAdmin(req, res, async () => {
    try {
      const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 12, 1), 50);
      res.json({ activity: await activity.listRecent(limit) });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unable to load admin activity' });
    }
  });
}

module.exports = { adminActivityEndpoint };
