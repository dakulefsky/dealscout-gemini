const { createWebhookPublicationAdapter } = require('./webhookPublicationAdapter');
const { createWahaStatusPublicationAdapter } = require('./wahaStatusPublicationAdapter');

function createPublicationAdapter(config, options = {}) {
  if (config?.transport === 'webhook') return createWebhookPublicationAdapter(config, options);
  if (config?.transport === 'waha') return createWahaStatusPublicationAdapter(config, options);
  throw new Error(`Unsupported publication transport: ${config?.transport || 'missing'}`);
}

module.exports = { createPublicationAdapter };
