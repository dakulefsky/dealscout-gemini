const dealQueries = require('../repositories/dealQueryRepository');
const publication = require('./publicationService');
const worker = require('./publicationWorker');
const publicationMetrics = require('../repositories/publicationMetricsRepository');
const postgres = require('../storage/postgres');
const channelSettings = require('./channelSettingsService');
const { CHANNEL_POLICY } = require('./distributionPolicy');

const WHATSAPP_STATUS_PUBLICATION_LOCK = 620031;

function sleep(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function runPublicationCycleUnlocked(config, adapter, dependencies = {}) {
  const queries = dependencies.dealQueries || dealQueries;
  const publicationService = dependencies.publication || publication;
  const publicationWorker = dependencies.worker || worker;
  const metrics = dependencies.publicationMetrics || publicationMetrics;
  const settings = dependencies.channelSettings || channelSettings;
  const nowUnix = typeof dependencies.nowUnix === 'function' ? dependencies.nowUnix : () => Math.floor(Date.now() / 1000);
  const policy = CHANNEL_POLICY[config.channel];
  if (!policy) throw new Error(`Unsupported publication channel: ${config.channel}`);

  if (config.channel === 'whatsapp_status') {
    const state = await settings.get('whatsapp_status');
    if (!state.enabled) {
      return {
        channel: config.channel,
        candidates: 0,
        selected: 0,
        enqueued: 0,
        attempts: [],
        published: 0,
        retriesScheduled: 0,
        failed: 0,
        cadenceDeferred: true,
        paused: true,
        nextPublishEligibleAt: null,
      };
    }
  }

  const candidates = await queries.list({
    minDiscount: policy.minDiscountPercent,
    sort: '-discount_percent',
    limit: config.candidateLimit,
  });
  const queued = await publicationService.queueBestDeals(config.channel, candidates, {
    limit: config.queueBatch,
  });

  const lastPublishedAt = await metrics.latestPublishedAt(config.channel);
  const spacingSeconds = Math.max(0, Number(config.minPublishSpacingSeconds) || 0);
  const spacingRemaining = lastPublishedAt && spacingSeconds
    ? Math.max(0, Number(lastPublishedAt) + spacingSeconds - nowUnix())
    : 0;

  if (spacingRemaining > 0) {
    return {
      channel: config.channel,
      candidates: candidates.length,
      selected: queued.selectedCount,
      enqueued: queued.createdCount,
      attempts: [],
      published: 0,
      retriesScheduled: 0,
      failed: 0,
      cadenceDeferred: true,
      paused: false,
      nextPublishEligibleAt: Number(lastPublishedAt) + spacingSeconds,
    };
  }

  const configuredAttempts = Math.max(1, Number(config.maxPublishesPerCycle) || 1);
  const maxAttempts = config.channel === 'whatsapp_status' ? 1 : configuredAttempts;
  const attempts = [];
  for (let index = 0; index < maxAttempts; index += 1) {
    const result = await publicationWorker.runPublicationOnce(config.channel, adapter);
    attempts.push(result);
    if (result.status === 'idle') break;
  }

  return {
    channel: config.channel,
    candidates: candidates.length,
    selected: queued.selectedCount,
    enqueued: queued.createdCount,
    attempts,
    published: attempts.filter((item) => item.status === 'published').length,
    retriesScheduled: attempts.filter((item) => item.status === 'retry_scheduled').length,
    failed: attempts.filter((item) => item.status === 'failed').length,
    cadenceDeferred: false,
    paused: false,
    nextPublishEligibleAt: null,
  };
}

async function runPublicationCycle(config, adapter, dependencies = {}) {
  if (config.channel !== 'whatsapp_status') return runPublicationCycleUnlocked(config, adapter, dependencies);
  const storage = dependencies.postgres || postgres;
  const lock = await storage.withAdvisoryLock(
    WHATSAPP_STATUS_PUBLICATION_LOCK,
    () => runPublicationCycleUnlocked(config, adapter, dependencies),
  );
  if (lock.acquired) return lock.result;
  return {
    channel: config.channel,
    candidates: 0,
    selected: 0,
    enqueued: 0,
    attempts: [],
    published: 0,
    retriesScheduled: 0,
    failed: 0,
    cadenceDeferred: true,
    coordinationDeferred: true,
    paused: false,
    nextPublishEligibleAt: null,
  };
}

async function runPublicationLoop(config, adapter, { signal, onCycle, onError } = {}) {
  while (!signal?.aborted) {
    try {
      const result = await runPublicationCycle(config, adapter);
      onCycle?.(result);
    } catch (error) {
      onError?.(error);
    }
    if (signal?.aborted) break;
    await sleep(config.pollMs, signal);
  }
}

module.exports = { WHATSAPP_STATUS_PUBLICATION_LOCK, runPublicationCycle, runPublicationCycleUnlocked, runPublicationLoop, sleep };
