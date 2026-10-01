const { requireAdmin } = require('./auth');
const siteSettings = require('../services/siteRuntimeSettingsService');
const { getActivePromotion } = require('../services/amazonSeasonalPromotion');

function isIsoDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value); }

function validatePrimeDayDates(start, end) {
  if (Boolean(start) !== Boolean(end)) return { valid: false, error: 'Set both Prime Day dates, or clear both.' };
  if (!start) return { valid: true };
  if (!isIsoDate(start) || !isIsoDate(end)) return { valid: false, error: 'Use valid YYYY-MM-DD calendar dates.' };
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end) {
    return { valid: false, error: 'Use valid calendar dates.' };
  }
  const days = (endDate.getTime() - startDate.getTime()) / 86400000;
  if (days < 0 || days > 6) return { valid: false, error: 'Prime Day must be a date range of one to seven days.' };
  return { valid: true };
}

async function settings() {
  const [start, end] = await Promise.all([
    siteSettings.get('amazon_prime_day_start'),
    siteSettings.get('amazon_prime_day_end'),
  ]);
  return { primeDayStart: start.value || '', primeDayEnd: end.value || '' };
}

function amazonSeasonalPromotionEndpoint(req, res, next) {
  if (req.path !== '/amazon-seasonal-promotion') return next();
  return requireAdmin(req, res, async () => {
    try {
      if (req.method === 'POST') {
        const start = String(req.body?.primeDayStart || '').trim();
        const end = String(req.body?.primeDayEnd || '').trim();
        const validation = validatePrimeDayDates(start, end);
        if (!validation.valid) return res.status(400).json({ error: validation.error });
        await Promise.all([
          siteSettings.set('amazon_prime_day_start', start),
          siteSettings.set('amazon_prime_day_end', end),
        ]);
      } else if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      return res.json({ ...(await settings()), activePromotion: await getActivePromotion() });
    } catch (error) {
      return res.status(503).json({ error: 'Seasonal promotion settings unavailable', details: error.message });
    }
  });
}

module.exports = { amazonSeasonalPromotionEndpoint, validatePrimeDayDates };
