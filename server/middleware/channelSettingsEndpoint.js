const { requireAdmin } = require('./auth');
const channelSettings = require('../services/channelSettingsService');

function channelSettingsEndpoint(req, res, next) {
  if (req.path !== '/channel-settings') return next();
  return requireAdmin(req, res, async () => {
    try {
      if (req.method === 'GET') {
        return res.json({ whatsappStatus: await channelSettings.get('whatsapp_status') });
      }
      if (req.method === 'POST') {
        if (typeof req.body?.whatsappStatusEnabled !== 'boolean') {
          return res.status(400).json({ error: 'whatsappStatusEnabled must be boolean' });
        }
        return res.json({ whatsappStatus: await channelSettings.setEnabled('whatsapp_status', req.body.whatsappStatusEnabled) });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      return res.status(500).json({ error: 'Channel settings unavailable', details: error.message });
    }
  });
}

module.exports = { channelSettingsEndpoint };
