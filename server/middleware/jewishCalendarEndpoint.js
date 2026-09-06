const { requireAdmin } = require('./auth');
const jewishClosure = require('../services/jewishClosureService');

function jewishCalendarEndpoint(req, res, next) {
  if (req.path !== '/jewish-calendar') return next();
  return requireAdmin(req, res, async () => {
    try {
      const [status, upcoming] = await Promise.all([
        jewishClosure.currentStatus(),
        jewishClosure.upcomingClosures({ limit: 20 }),
      ]);
      return res.json({ timezone: 'Asia/Jerusalem', status, upcoming });
    } catch (error) {
      return res.status(503).json({ error: 'Jerusalem closure calendar unavailable', details: error.message });
    }
  });
}

module.exports = { jewishCalendarEndpoint };
