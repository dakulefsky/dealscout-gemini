const dealQueries = require('../repositories/dealQueryRepository');
const publication = require('./publicationService');
const worker = require('./publicationWorker');
const publicationMetrics = require('../repositories/publicationMetricsRepository');
const { CHANNEL_POLICY } = require('./distributionPolicy');

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

async function runPublicationCycle(config, adapter, dependencies = {}) {
  const queries = dependencies.dealQueries || dealQueries;
  const publicationService = dependencies.publication || publication;
  const publicationWorker = dependencies.worker || worker;
  const metrics = dependencies.publicationMetrics || publicationMetrics;
  const nowUnix = typeof dependencies.nowUnix === 'function' ? dependencies.nowUnix : () => Math.floor(Date.now() / 1000);
  const policy = CHANNEL_POLICY[config.channel];
  if (!policy) throw new Error(`Unsupported publication channel: ${config.channel}`);

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
      nextPublishEligibleAt: Number(lastPublishedAt) + spacingSeconds,
    };
  }

  const attempts = [];
  for (let index = 0; index < config.maxPublishesPerCycle; index += 1) {
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

module.exports = { runPublicationCycle, runPublicationLoop, sleep };
