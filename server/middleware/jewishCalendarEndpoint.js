const { requireAdmin } = require('./auth');
const jewishClosure = require('../services/jewishClosureService');
const siteSettings = require('../services/siteRuntimeSettingsService');

async function selectedLocation() {
  const setting = await siteSettings.get('closure_location');
  return setting.value || 'jerusalem';
}

function jewishCalendarEndpoint(req, res, next) {
  if (req.path !== '/jewish-calendar') return next();
  return requireAdmin(req, res, async () => {
    try {
      if (req.method === 'POST') {
        const location = String(req.body?.location || '').trim().toLowerCase();
        jewishClosure.locationConfig(location);
        await siteSettings.set('closure_location', location);
        jewishClosure.resetCaches();
      } else if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const location = await selectedLocation();
      const config = jewishClosure.locationConfig(location);
      const [status, upcoming] = await Promise.all([
        jewishClosure.currentStatus(new Date(), { location }),
        jewishClosure.upcomingClosures({ limit: 20, location }),
      ]);
      return res.json({
        location,
        timezone: config.timezone,
        title: config.title,
        schedule: config.scheduleLabel,
        candleMinutes: config.candleMinutes,
        havdalahMinutes: config.havdalahMinutes,
        status,
        upcoming,
      });
    } catch (error) {
      if (/Unsupported closure location/.test(error.message)) return res.status(400).json({ error: error.message });
      return res.status(503).json({ error: 'Jewish closure calendar unavailable', details: error.message });
    }
  });
}

module.exports = { jewishCalendarEndpoint, selectedLocation };
