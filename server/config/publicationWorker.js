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

function resolvePublicationWorkerConfig(env = process.env, { isProduction = env.NODE_ENV === 'production' } = {}) {
  const channel = clean(env.PUBLICATION_CHANNEL).toLowerCase();
  if (!CHANNEL_POLICY[channel]) throw new Error('PUBLICATION_CHANNEL must be one of: web, app, whatsapp_status');

  const transport = clean(env.PUBLICATION_TRANSPORT).toLowerCase();
  if (transport !== 'webhook') throw new Error('PUBLICATION_TRANSPORT must be webhook');

  const runMode = (clean(env.PUBLICATION_RUN_MODE) || 'continuous').toLowerCase();
  if (!['continuous', 'once'].includes(runMode)) throw new Error('PUBLICATION_RUN_MODE must be continuous or once');

  const webhookUrl = clean(env.PUBLICATION_WEBHOOK_URL);
  let parsedWebhook;
  try {
    parsedWebhook = new URL(webhookUrl);
  } catch {
    throw new Error('PUBLICATION_WEBHOOK_URL must be a valid absolute URL');
  }
  if (!['http:', 'https:'].includes(parsedWebhook.protocol)) throw new Error('PUBLICATION_WEBHOOK_URL must use http or https');
  if (isProduction && parsedWebhook.protocol !== 'https:') throw new Error('PUBLICATION_WEBHOOK_URL must use https in production');

  const webhookToken = clean(env.PUBLICATION_WEBHOOK_TOKEN);
  if (isProduction && webhookToken.length < 16) {
    throw new Error('PUBLICATION_WEBHOOK_TOKEN must contain at least 16 characters in production');
  }

  return {
    channel,
    transport,
    runMode,
    webhookUrl: parsedWebhook.toString(),
    webhookToken,
    pollMs: boundedInteger(env.PUBLICATION_POLL_MS, 30_000, { min: 1_000, max: 300_000, name: 'PUBLICATION_POLL_MS' }),
    queueBatch: boundedInteger(env.PUBLICATION_QUEUE_BATCH, 5, { min: 1, max: 50, name: 'PUBLICATION_QUEUE_BATCH' }),
    candidateLimit: boundedInteger(env.PUBLICATION_CANDIDATE_LIMIT, 100, { min: 10, max: 100, name: 'PUBLICATION_CANDIDATE_LIMIT' }),
    maxPublishesPerCycle: boundedInteger(env.PUBLICATION_MAX_PER_CYCLE, 5, { min: 1, max: 50, name: 'PUBLICATION_MAX_PER_CYCLE' }),
    webhookTimeoutMs: boundedInteger(env.PUBLICATION_WEBHOOK_TIMEOUT_MS, 15_000, { min: 1_000, max: 60_000, name: 'PUBLICATION_WEBHOOK_TIMEOUT_MS' }),
  };
}

module.exports = { resolvePublicationWorkerConfig, boundedInteger };
