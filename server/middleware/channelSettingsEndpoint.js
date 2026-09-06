const { requireAdmin } = require('./auth');
const channelSettings = require('../services/channelSettingsService');

async function snapshot() {
  const [whatsappStatus, providerApi] = await Promise.all([
    channelSettings.get('whatsapp_status'),
    channelSettings.get('provider_api'),
  ]);
  return { whatsappStatus, providerApi };
}

function channelSettingsEndpoint(req, res, next) {
  if (req.path !== '/channel-settings') return next();
  return requireAdmin(req, res, async () => {
    try {
      if (req.method === 'GET') return res.json(await snapshot());
      if (req.method === 'POST') {
        const hasWhatsApp = typeof req.body?.whatsappStatusEnabled === 'boolean';
        const hasProviderApi = typeof req.body?.providerApiEnabled === 'boolean';
        if (!hasWhatsApp && !hasProviderApi) {
          return res.status(400).json({ error: 'Provide whatsappStatusEnabled or providerApiEnabled as a boolean' });
        }
        if (hasWhatsApp) await channelSettings.setEnabled('whatsapp_status', req.body.whatsappStatusEnabled);
        if (hasProviderApi) await channelSettings.setEnabled('provider_api', req.body.providerApiEnabled);
        return res.json(await snapshot());
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      return res.status(500).json({ error: 'Channel settings unavailable', details: error.message });
    }
  });
}

module.exports = { channelSettingsEndpoint };
