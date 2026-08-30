const crypto = require('crypto');
const db = require('../db');
const postgres = require('../storage/postgres');
const { CHANNEL_POLICY, evaluateDistribution } = require('../services/distributionPolicy');

const STATES = Object.freeze({
  QUEUED: 'queued',
  LEASED: 'leased',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const POLICY_VERSION = 'distribution-v1';
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_RETRY_SECONDS = 60 * 60;
let schemaReady = false;

function nowUnix() { return Math.floor(Date.now() / 1000); }
function asUnix(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
}

function safeText(value, max = 2000) {
  return String(value || '').trim().slice(0, max);
}

function parseSnapshot(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function snapshotDeal(deal = {}) {
  return {
    asin: String(deal.asin || '').trim().toUpperCase(),
    title: safeText(deal.title, 500),
    category: safeText(deal.category, 160) || null,
    originalPrice: Number(deal.original_price ?? deal.originalPrice ?? 0),
    salePrice: Number(deal.sale_price ?? deal.salePrice ?? 0),
    discountPercent: Number(deal.discount_percent ?? deal.discountPercent ?? 0),
    qualityScore: Number(deal.quality_score ?? deal.qualityScore ?? 0),
    imageUrl: safeText(deal.image_url ?? deal.imageUrl, 2000) || null,
    productUrl: safeText(deal.product_url ?? deal.productUrl, 2000) || null,
    sourceProvider: safeText(deal.source_provider ?? deal.sourceProvider, 120) || null,
    sourcePriceCheckAt: asUnix(deal.price_check_at ?? deal.priceCheckAt),
  };
}

function normalizeJob(input = {}) {
  return {
    ...input,
    id: String(input.id || ''),
    channel: String(input.channel || ''),
    asin: String(input.asin || '').toUpperCase(),
    source_price_check_at: asUnix(input.source_price_check_at ?? input.sourcePriceCheckAt),
    policy_version: String(input.policy_version ?? input.policyVersion ?? POLICY_VERSION),
    idempotency_key: String(input.idempotency_key ?? input.idempotencyKey ?? ''),
    state: String(input.state || STATES.QUEUED),
    scheduled_at: asUnix(input.scheduled_at ?? input.scheduledAt),
    lease_until: asUnix(input.lease_until ?? input.leaseUntil) || null,
    attempts: Math.max(0, Number(input.attempts) || 0),
    next_attempt_at: asUnix(input.next_attempt_at ?? input.nextAttemptAt) || null,
    last_error: input.last_error ?? input.lastError ?? null,
    external_publication_id: input.external_publication_id ?? input.externalPublicationId ?? null,
    published_at: asUnix(input.published_at ?? input.publishedAt) || null,
    cancelled_at: asUnix(input.cancelled_at ?? input.cancelledAt) || null,
    snapshot: parseSnapshot(input.snapshot ?? input.snapshot_json),
    created_at: asUnix(input.created_at ?? input.createdAt),
    updated_at: asUnix(input.updated_at ?? input.updatedAt),
  };
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS publication_jobs (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      asin VARCHAR(10) NOT NULL,
      source_price_check_at BIGINT NOT NULL,
      policy_version TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL DEFAULT 'queued',
      scheduled_at BIGINT NOT NULL,
      lease_until BIGINT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at BIGINT,
      last_error TEXT,
      external_publication_id TEXT,
      published_at BIGINT,
      cancelled_at BIGINT,
      snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      CONSTRAINT publication_jobs_state_check CHECK (state IN ('queued','leased','published','failed','cancelled'))
    );
    CREATE INDEX IF NOT EXISTS idx_publication_jobs_ready
      ON publication_jobs (channel, state, scheduled_at, next_attempt_at, lease_until);
    CREATE INDEX IF NOT EXISTS idx_publication_jobs_published
      ON publication_jobs (channel, published_at DESC) WHERE state = 'published';
    CREATE INDEX IF NOT EXISTS idx_publication_jobs_asin
      ON publication_jobs (asin, channel, created_at DESC);
  `);
  schemaReady = true;
}

function rowFromPg(row) {
  return row ? normalizeJob(row) : null;
}

function validateChannel(channel) {
  if (!CHANNEL_POLICY[channel]) throw new Error(`Unsupported distribution channel: ${channel}`);
  return channel;
}

function buildIdempotencyKey(channel, asin, sourcePriceCheckAt) {
  return `${channel}:${asin}:${sourcePriceCheckAt}`;
}

async function enqueueDeal(deal, channel, options = {}) {
  validateChannel(channel);
  const now = asUnix(options.nowUnix, nowUnix());
  const evaluation = evaluateDistribution(deal, channel, now);
  if (!evaluation.eligible) return { created: false, reason: 'ineligible', evaluation, job: null };

  const snapshot = snapshotDeal(deal);
  const asin = snapshot.asin;
  const sourcePriceCheckAt = snapshot.sourcePriceCheckAt;
  if (!asin || !sourcePriceCheckAt) return { created: false, reason: 'missing_source_snapshot', evaluation, job: null };

  const scheduledAt = asUnix(options.scheduledAt, now);
  const idempotencyKey = safeText(options.idempotencyKey || buildIdempotencyKey(channel, asin, sourcePriceCheckAt), 500);
  const record = normalizeJob({
    id: crypto.randomUUID(),
    channel,
    asin,
    source_price_check_at: sourcePriceCheckAt,
    policy_version: safeText(options.policyVersion || POLICY_VERSION, 120),
    idempotency_key: idempotencyKey,
    state: STATES.QUEUED,
    scheduled_at: scheduledAt,
    snapshot,
    created_at: now,
    updated_at: now,
  });

  if (!postgres.isConfigured()) {
    const existing = db.tables.publication_jobs.find((job) => job.idempotency_key === idempotencyKey);
    if (existing) return { created: false, reason: 'duplicate', evaluation, job: normalizeJob(existing) };
    db.tables.publication_jobs.push({ ...record, snapshot_json: record.snapshot });
    db.saveDb();
    return { created: true, reason: 'queued', evaluation, job: record };
  }

  await ensureSchema();
  const inserted = await postgres.query(`
    INSERT INTO publication_jobs (
      id, channel, asin, source_price_check_at, policy_version, idempotency_key,
      state, scheduled_at, snapshot, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING *`, [
      record.id, record.channel, record.asin, record.source_price_check_at,
      record.policy_version, record.idempotency_key, record.state, record.scheduled_at,
      JSON.stringify(record.snapshot), record.created_at, record.updated_at,
    ]);

  if (inserted.rowCount) return { created: true, reason: 'queued', evaluation, job: rowFromPg(inserted.rows[0]) };
  const existing = await postgres.query('SELECT * FROM publication_jobs WHERE idempotency_key = $1 LIMIT 1', [idempotencyKey]);
  return { created: false, reason: 'duplicate', evaluation, job: rowFromPg(existing.rows[0]) };
}

function readyFallbackJob(channel, now) {
  return db.tables.publication_jobs
    .map((job) => normalizeJob(job))
    .filter((job) => job.channel === channel)
    .filter((job) => job.scheduled_at <= now)
    .filter((job) => !job.next_attempt_at || job.next_attempt_at <= now)
    .filter((job) => job.state === STATES.QUEUED || (job.state === STATES.LEASED && job.lease_until && job.lease_until <= now))
    .sort((a, b) => a.scheduled_at - b.scheduled_at || a.created_at - b.created_at)[0] || null;
}

async function leaseNext(channel, options = {}) {
  validateChannel(channel);
  const now = asUnix(options.nowUnix, nowUnix());
  const leaseSeconds = Math.max(15, Math.min(15 * 60, Number(options.leaseSeconds) || DEFAULT_LEASE_SECONDS));
  const leaseUntil = now + leaseSeconds;

  if (!postgres.isConfigured()) {
    const candidate = readyFallbackJob(channel, now);
    if (!candidate) return null;
    const index = db.tables.publication_jobs.findIndex((job) => job.id === candidate.id);
    if (index < 0) return null;
    const next = normalizeJob({ ...candidate, state: STATES.LEASED, lease_until: leaseUntil, attempts: candidate.attempts + 1, updated_at: now });
    db.tables.publication_jobs[index] = { ...next, snapshot_json: next.snapshot };
    db.saveDb();
    return next;
  }

  await ensureSchema();
  const client = await postgres.getPool().connect();
  try {
    await client.query('BEGIN');
    const candidate = await client.query(`
      SELECT id
        FROM publication_jobs
       WHERE channel = $1
         AND scheduled_at <= $2
         AND (next_attempt_at IS NULL OR next_attempt_at <= $2)
         AND (state = 'queued' OR (state = 'leased' AND lease_until IS NOT NULL AND lease_until <= $2))
       ORDER BY scheduled_at ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`, [channel, now]);
    if (!candidate.rowCount) {
      await client.query('COMMIT');
      return null;
    }
    const updated = await client.query(`
      UPDATE publication_jobs
         SET state = 'leased', lease_until = $2, attempts = attempts + 1, updated_at = $3
       WHERE id = $1
       RETURNING *`, [candidate.rows[0].id, leaseUntil, now]);
    await client.query('COMMIT');
    return rowFromPg(updated.rows[0]);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw err;
  } finally {
    client.release();
  }
}

async function findById(id) {
  const key = String(id || '');
  if (!key) return null;
  if (!postgres.isConfigured()) {
    const job = db.tables.publication_jobs.find((row) => row.id === key);
    return job ? normalizeJob(job) : null;
  }
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM publication_jobs WHERE id = $1 LIMIT 1', [key]);
  return rowFromPg(result.rows[0]);
}

async function markPublished(id, options = {}) {
  const now = asUnix(options.nowUnix, nowUnix());
  const externalId = safeText(options.externalPublicationId, 500) || null;
  if (!postgres.isConfigured()) {
    const index = db.tables.publication_jobs.findIndex((job) => job.id === id && job.state === STATES.LEASED);
    if (index < 0) return null;
    const next = normalizeJob({
      ...db.tables.publication_jobs[index], state: STATES.PUBLISHED, lease_until: null,
      next_attempt_at: null, last_error: null, external_publication_id: externalId,
      published_at: now, updated_at: now,
    });
    db.tables.publication_jobs[index] = { ...next, snapshot_json: next.snapshot };
    db.saveDb();
    return next;
  }
  await ensureSchema();
  const result = await postgres.query(`
    UPDATE publication_jobs
       SET state = 'published', lease_until = NULL, next_attempt_at = NULL,
           last_error = NULL, external_publication_id = $2, published_at = $3, updated_at = $3
     WHERE id = $1 AND state = 'leased'
     RETURNING *`, [id, externalId, now]);
  return rowFromPg(result.rows[0]);
}

function retryDelaySeconds(attempts) {
  const count = Math.max(1, Number(attempts) || 1);
  return Math.min(MAX_RETRY_SECONDS, 60 * (2 ** Math.min(6, count - 1)));
}

async function failJob(id, error, options = {}) {
  const now = asUnix(options.nowUnix, nowUnix());
  const maxAttempts = Math.max(1, Math.min(20, Number(options.maxAttempts) || DEFAULT_MAX_ATTEMPTS));
  const current = await findById(id);
  if (!current || current.state !== STATES.LEASED) return null;
  const terminal = current.attempts >= maxAttempts;
  const nextAttemptAt = terminal ? null : now + retryDelaySeconds(current.attempts);
  const errorText = safeText(error?.message || error || 'Publication failed', 2000);

  if (!postgres.isConfigured()) {
    const index = db.tables.publication_jobs.findIndex((job) => job.id === id && job.state === STATES.LEASED);
    if (index < 0) return null;
    const next = normalizeJob({
      ...db.tables.publication_jobs[index],
      state: terminal ? STATES.FAILED : STATES.QUEUED,
      lease_until: null,
      next_attempt_at: nextAttemptAt,
      last_error: errorText,
      updated_at: now,
    });
    db.tables.publication_jobs[index] = { ...next, snapshot_json: next.snapshot };
    db.saveDb();
    return next;
  }

  await ensureSchema();
  const result = await postgres.query(`
    UPDATE publication_jobs
       SET state = $2, lease_until = NULL, next_attempt_at = $3,
           last_error = $4, updated_at = $5
     WHERE id = $1 AND state = 'leased'
     RETURNING *`, [id, terminal ? STATES.FAILED : STATES.QUEUED, nextAttemptAt, errorText, now]);
  return rowFromPg(result.rows[0]);
}

async function cancelJob(id, reason = 'No longer eligible', options = {}) {
  const now = asUnix(options.nowUnix, nowUnix());
  const errorText = safeText(reason, 2000);
  if (!postgres.isConfigured()) {
    const index = db.tables.publication_jobs.findIndex((job) => job.id === id && [STATES.QUEUED, STATES.LEASED].includes(job.state));
    if (index < 0) return null;
    const next = normalizeJob({
      ...db.tables.publication_jobs[index], state: STATES.CANCELLED, lease_until: null,
      next_attempt_at: null, last_error: errorText, cancelled_at: now, updated_at: now,
    });
    db.tables.publication_jobs[index] = { ...next, snapshot_json: next.snapshot };
    db.saveDb();
    return next;
  }
  await ensureSchema();
  const result = await postgres.query(`
    UPDATE publication_jobs
       SET state = 'cancelled', lease_until = NULL, next_attempt_at = NULL,
           last_error = $2, cancelled_at = $3, updated_at = $3
     WHERE id = $1 AND state IN ('queued','leased')
     RETURNING *`, [id, errorText, now]);
  return rowFromPg(result.rows[0]);
}

async function recentPublishedAsins(channel, sinceUnix) {
  validateChannel(channel);
  const since = asUnix(sinceUnix, nowUnix() - 7 * 24 * 60 * 60);
  if (!postgres.isConfigured()) {
    return [...new Set(db.tables.publication_jobs
      .map((job) => normalizeJob(job))
      .filter((job) => job.channel === channel && job.state === STATES.PUBLISHED && job.published_at && job.published_at >= since)
      .map((job) => job.asin))];
  }
  await ensureSchema();
  const result = await postgres.query(`
    SELECT DISTINCT asin
      FROM publication_jobs
     WHERE channel = $1 AND state = 'published' AND published_at >= $2`, [channel, since]);
  return result.rows.map((row) => String(row.asin).toUpperCase());
}

module.exports = {
  STATES,
  POLICY_VERSION,
  DEFAULT_LEASE_SECONDS,
  DEFAULT_MAX_ATTEMPTS,
  ensureSchema,
  enqueueDeal,
  leaseNext,
  findById,
  markPublished,
  failJob,
  cancelJob,
  recentPublishedAsins,
  retryDelaySeconds,
  buildIdempotencyKey,
  snapshotDeal,
  normalizeJob,
};
