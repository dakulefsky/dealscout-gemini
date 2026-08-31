const db = require('../db');
const postgres = require('../storage/postgres');
const queue = require('./publicationQueueRepository');

function asUnix(value, fallback = Math.floor(Date.now() / 1000)) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return number > 10_000_000_000 ? Math.floor(number / 1000) : Math.floor(number);
}

function fallbackHealth(now) {
  const jobs = (db.tables.publication_jobs || []).map((job) => queue.normalizeJob ? queue.normalizeJob(job) : job);
  const counts = { queued: 0, leased: 0, published: 0, failed: 0, cancelled: 0 };
  let overdue = 0;
  let retryWaiting = 0;
  let oldestQueuedAt = null;
  let lastPublishedAt = null;
  for (const job of jobs) {
    if (Object.hasOwn(counts, job.state)) counts[job.state] += 1;
    if (job.state === 'queued') {
      const scheduled = Number(job.scheduled_at || 0);
      const retryAt = Number(job.next_attempt_at || 0);
      if (scheduled && scheduled <= now && (!retryAt || retryAt <= now)) overdue += 1;
      if (retryAt > now) retryWaiting += 1;
      if (scheduled && (oldestQueuedAt === null || scheduled < oldestQueuedAt)) oldestQueuedAt = scheduled;
    }
    if (job.state === 'published' && Number(job.published_at || 0) > Number(lastPublishedAt || 0)) lastPublishedAt = Number(job.published_at);
  }
  return { total: jobs.length, counts, overdue, retryWaiting, oldestQueuedAt, lastPublishedAt };
}

async function latestPublishedAt(channel) {
  const key = String(channel || '').trim();
  if (!key) return null;
  if (!postgres.isConfigured()) {
    let latest = null;
    for (const raw of db.tables.publication_jobs || []) {
      const job = queue.normalizeJob ? queue.normalizeJob(raw) : raw;
      if (job.channel !== key || job.state !== 'published' || !job.published_at) continue;
      const timestamp = Number(job.published_at);
      if (Number.isFinite(timestamp) && (latest === null || timestamp > latest)) latest = timestamp;
    }
    return latest;
  }
  await queue.ensureSchema();
  const result = await postgres.query(`
    SELECT MAX(published_at) AS last_published_at
      FROM publication_jobs
     WHERE channel = $1 AND state = 'published'
  `, [key]);
  const value = result.rows[0]?.last_published_at;
  return value == null ? null : Number(value);
}

async function health(options = {}) {
  const now = asUnix(options.nowUnix);
  if (!postgres.isConfigured()) return fallbackHealth(now);
  await queue.ensureSchema();
  const result = await postgres.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE state = 'queued')::int AS queued,
      COUNT(*) FILTER (WHERE state = 'leased')::int AS leased,
      COUNT(*) FILTER (WHERE state = 'published')::int AS published,
      COUNT(*) FILTER (WHERE state = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE state = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (
        WHERE state = 'queued'
          AND scheduled_at <= $1
          AND (next_attempt_at IS NULL OR next_attempt_at <= $1)
      )::int AS overdue,
      COUNT(*) FILTER (WHERE state = 'queued' AND next_attempt_at > $1)::int AS retry_waiting,
      MIN(scheduled_at) FILTER (WHERE state = 'queued') AS oldest_queued_at,
      MAX(published_at) FILTER (WHERE state = 'published') AS last_published_at
    FROM publication_jobs
  `, [now]);
  const row = result.rows[0] || {};
  return {
    total: Number(row.total || 0),
    counts: {
      queued: Number(row.queued || 0), leased: Number(row.leased || 0), published: Number(row.published || 0),
      failed: Number(row.failed || 0), cancelled: Number(row.cancelled || 0),
    },
    overdue: Number(row.overdue || 0),
    retryWaiting: Number(row.retry_waiting || 0),
    oldestQueuedAt: row.oldest_queued_at == null ? null : Number(row.oldest_queued_at),
    lastPublishedAt: row.last_published_at == null ? null : Number(row.last_published_at),
  };
}

module.exports = { health, fallbackHealth, latestPublishedAt };
