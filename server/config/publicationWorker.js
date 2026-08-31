const { CHANNEL_POLICY } = require('../services/distributionPolicy');

function clean(value) {
  return String(value ?? '').trim();
}

function boundedInteger(value, fallback, { min, max, name }) {
  const raw = clean(value);
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

function parseHttpUrl(value, name, { isProduction, allowLocalHttp = false } = {}) {
  let parsed;
  try { parsed = new URL(clean(value)); }
  catch { throw new Error(`${name} must be a valid absolute URL`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${name} must use http or https`);
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (isProduction && parsed.protocol !== 'https:' && !(allowLocalHttp && local)) {
    throw new Error(`${name} must use https in production`);
  }
  return parsed.toString();
}

function resolvePublicationWorkerConfig(env = process.env, { isProduction = env.NODE_ENV === 'production' } = {}) {
  const channel = clean(env.PUBLICATION_CHANNEL).toLowerCase();
  if (!CHANNEL_POLICY[channel]) throw new Error('PUBLICATION_CHANNEL must be one of: web, app, whatsapp_status');

  const transport = clean(env.PUBLICATION_TRANSPORT).toLowerCase();
  if (!['webhook', 'waha'].includes(transport)) throw new Error('PUBLICATION_TRANSPORT must be webhook or waha');
  if (transport === 'waha' && channel !== 'whatsapp_status') throw new Error('PUBLICATION_TRANSPORT=waha only supports PUBLICATION_CHANNEL=whatsapp_status');

  const runMode = (clean(env.PUBLICATION_RUN_MODE) || 'continuous').toLowerCase();
  if (!['continuous', 'once'].includes(runMode)) throw new Error('PUBLICATION_RUN_MODE must be continuous or once');

  const isWhatsAppStatus = channel === 'whatsapp_status';
  const config = {
    channel,
    transport,
    runMode,
    pollMs: boundedInteger(env.PUBLICATION_POLL_MS, isWhatsAppStatus ? 30 * 60_000 : 30_000, {
      min: 1_000,
      max: isWhatsAppStatus ? 6 * 60 * 60_000 : 300_000,
      name: 'PUBLICATION_POLL_MS',
    }),
    minPublishSpacingSeconds: boundedInteger(env.PUBLICATION_MIN_SPACING_SECONDS, isWhatsAppStatus ? 30 * 60 : 0, {
      min: isWhatsAppStatus ? 5 * 60 : 0,
      max: isWhatsAppStatus ? 6 * 60 * 60 : 24 * 60 * 60,
      name: 'PUBLICATION_MIN_SPACING_SECONDS',
    }),
    queueBatch: boundedInteger(env.PUBLICATION_QUEUE_BATCH, isWhatsAppStatus ? 2 : 5, { min: 1, max: 50, name: 'PUBLICATION_QUEUE_BATCH' }),
    candidateLimit: boundedInteger(env.PUBLICATION_CANDIDATE_LIMIT, 100, { min: 10, max: 100, name: 'PUBLICATION_CANDIDATE_LIMIT' }),
    maxPublishesPerCycle: boundedInteger(env.PUBLICATION_MAX_PER_CYCLE, isWhatsAppStatus ? 1 : 5, { min: 1, max: 50, name: 'PUBLICATION_MAX_PER_CYCLE' }),
  };

  if (transport === 'webhook') {
    config.webhookUrl = parseHttpUrl(env.PUBLICATION_WEBHOOK_URL, 'PUBLICATION_WEBHOOK_URL', { isProduction });
    config.webhookToken = clean(env.PUBLICATION_WEBHOOK_TOKEN);
    if (isProduction && config.webhookToken.length < 16) {
      throw new Error('PUBLICATION_WEBHOOK_TOKEN must contain at least 16 characters in production');
    }
    config.webhookTimeoutMs = boundedInteger(env.PUBLICATION_WEBHOOK_TIMEOUT_MS, 15_000, { min: 1_000, max: 60_000, name: 'PUBLICATION_WEBHOOK_TIMEOUT_MS' });
    return config;
  }

  config.wahaBaseUrl = parseHttpUrl(env.WAHA_BASE_URL, 'WAHA_BASE_URL', { isProduction, allowLocalHttp: false });
  config.wahaApiKey = clean(env.WAHA_API_KEY);
  if (isProduction && config.wahaApiKey.length < 16) throw new Error('WAHA_API_KEY must contain at least 16 characters in production');
  config.wahaSession = clean(env.WAHA_SESSION);
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(config.wahaSession)) throw new Error('WAHA_SESSION must contain 1-64 safe session-name characters');
  config.wahaTimeoutMs = boundedInteger(env.WAHA_TIMEOUT_MS, 20_000, { min: 1_000, max: 60_000, name: 'WAHA_TIMEOUT_MS' });
  return config;
}

module.exports = { resolvePublicationWorkerConfig, boundedInteger, parseHttpUrl };
