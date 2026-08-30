const deals = require('../repositories/dealRepository');
const queue = require('../repositories/publicationQueueRepository');
const { evaluateDistribution, selectChannelDeals } = require('./distributionPolicy');

const DEFAULT_RECENT_WINDOW_SECONDS = 3 * 24 * 60 * 60;
const MAX_LEASE_SKIPS = 20;

function nowUnix() { return Math.floor(Date.now() / 1000); }
function unix(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
}

async function queueBestDeals(channel, candidates, options = {}) {
  const now = unix(options.nowUnix, nowUnix());
  const recentWindowSeconds = Math.max(0, Number(options.recentWindowSeconds) || DEFAULT_RECENT_WINDOW_SECONDS);
  const recent = await queue.recentPublishedAsins(channel, now - recentWindowSeconds);
  const selected = selectChannelDeals(candidates, channel, {
    nowUnix: now,
    limit: options.limit || 10,
    excludedAsins: [...recent, ...(options.excludedAsins || [])],
  });

  const results = [];
  for (const deal of selected) {
    results.push(await queue.enqueueDeal(deal, channel, {
      nowUnix: now,
      scheduledAt: options.scheduledAt || now,
    }));
  }
  return {
    channel,
    selectedCount: selected.length,
    createdCount: results.filter((result) => result.created).length,
    jobs: results.map((result) => result.job).filter(Boolean),
  };
}

async function leaseNextPublishable(channel, options = {}) {
  const now = unix(options.nowUnix, nowUnix());
  const maxSkips = Math.max(1, Math.min(100, Number(options.maxSkips) || MAX_LEASE_SKIPS));

  for (let index = 0; index < maxSkips; index += 1) {
    const job = await queue.leaseNext(channel, {
      nowUnix: now,
      leaseSeconds: options.leaseSeconds,
    });
    if (!job) return null;

    const current = await deals.findByIdOrAsin(job.asin);
    if (!current) {
      await queue.cancelJob(job.id, 'Deal no longer exists', { nowUnix: now });
      continue;
    }

    const evaluation = evaluateDistribution(current, channel, now);
    if (!evaluation.eligible) {
      await queue.cancelJob(job.id, `Deal no longer eligible: ${evaluation.reasons.join(', ')}`, { nowUnix: now });
      continue;
    }

    const currentCheck = unix(current.price_check_at ?? current.priceCheckAt);
    if (!currentCheck || currentCheck !== job.source_price_check_at) {
      await queue.cancelJob(job.id, 'Verification snapshot changed before publication', { nowUnix: now });
      // Queue the newer verified snapshot if it still qualifies. The idempotency
      // key prevents duplicate jobs when multiple workers notice the same change.
      await queue.enqueueDeal(current, channel, { nowUnix: now, scheduledAt: now });
      continue;
    }

    return { job, deal: current, evaluation };
  }

  return null;
}

async function completePublication(jobId, externalPublicationId, options = {}) {
  return queue.markPublished(jobId, {
    externalPublicationId,
    nowUnix: unix(options.nowUnix, nowUnix()),
  });
}

async function failPublication(jobId, error, options = {}) {
  return queue.failJob(jobId, error, {
    maxAttempts: options.maxAttempts,
    nowUnix: unix(options.nowUnix, nowUnix()),
  });
}

module.exports = {
  DEFAULT_RECENT_WINDOW_SECONDS,
  queueBestDeals,
  leaseNextPublishable,
  completePublication,
  failPublication,
};
