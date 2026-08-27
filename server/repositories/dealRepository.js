const db = require('../db');
const postgres = require('../storage/postgres');

let schemaReady = false;

function nowUnix() { return Math.floor(Date.now() / 1000); }
function isVerified(deal) { return deal?.source_verified === 1 || deal?.source_verified === true; }

function normalizeReviews(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

function normalizeRecord(input) {
  const d = { ...input };
  d.id = String(d.id || d.asin || '').trim();
  d.asin = String(d.asin || d.id || '').trim().toUpperCase();
  d.original_price = Number(d.original_price ?? d.originalPrice ?? 0);
  d.sale_price = Number(d.sale_price ?? d.salePrice ?? 0);
  d.discount_percent = Number(d.discount_percent ?? d.discountPercent ?? 0);
  d.rating = Number(d.rating ?? 0);
  d.ratings_total = Number(d.ratings_total ?? d.ratingsTotal ?? 0);
  d.quality_score = Number(d.quality_score ?? d.qualityScore ?? 0);
  d.source_sufficient = d.source_sufficient === 1 || d.sourceSufficient === true ? 1 : 0;
  d.source_verified = d.source_verified === 1 || d.sourceVerified === true ? 1 : 0;
  d.is_expired = d.is_expired === 1 || d.isExpired === true ? 1 : 0;
  d.expired_at = d.expired_at ?? d.expiredAt ?? null;
  d.price_check_at = d.price_check_at ?? d.priceCheckAt ?? null;
  d.last_verify_attempt_at = d.last_verify_attempt_at ?? d.lastVerifyAttemptAt ?? null;
  d.created_at = d.created_at || nowUnix();
  d.reviews = normalizeReviews(d.reviews);
  if (process.env.NODE_ENV === 'production' && d.source_verified !== 1) {
    d.source_sufficient = 0;
    if (d.status === 'APPROVED') d.status = 'PENDING_REVIEW';
  }
  return d;
}

function shouldBootstrapDeal(input) {
  if (process.env.NODE_ENV !== 'production') return true;
  return normalizeRecord(input).source_verified === 1;
}

function toJsonFallback(record) {
  return { ...record, reviews: JSON.stringify(normalizeReviews(record.reviews)) };
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      asin VARCHAR(10) NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT,
      original_price NUMERIC(12,2) NOT NULL,
      sale_price NUMERIC(12,2) NOT NULL,
      discount_percent NUMERIC(6,2) NOT NULL,
      image_url TEXT,
      product_url TEXT,
      rating NUMERIC(3,2) NOT NULL DEFAULT 0,
      ratings_total BIGINT NOT NULL DEFAULT 0,
      quality_score NUMERIC(6,2) NOT NULL DEFAULT 0,
      short_bio TEXT,
      full_summary TEXT,
      pros TEXT,
      cons TEXT,
      reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_sufficient INTEGER NOT NULL DEFAULT 0,
      source_verified INTEGER NOT NULL DEFAULT 0,
      source_provider TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      is_expired INTEGER NOT NULL DEFAULT 0,
      expired_at BIGINT,
      price_check_at BIGINT,
      last_verify_attempt_at BIGINT,
      raw_source_data TEXT,
      created_at BIGINT NOT NULL
    );
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS quality_score NUMERIC(6,2) NOT NULL DEFAULT 0;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_verify_attempt_at BIGINT;
    CREATE INDEX IF NOT EXISTS idx_deals_visibility ON deals (status, is_expired, source_verified);
    CREATE INDEX IF NOT EXISTS idx_deals_category ON deals (category);
    CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deals_verify_queue ON deals (last_verify_attempt_at ASC NULLS FIRST, price_check_at ASC NULLS FIRST);
  `);

  if (process.env.NODE_ENV === 'production') {
    await postgres.query(`
      UPDATE deals
         SET source_sufficient = 0,
             status = CASE WHEN status = 'APPROVED' THEN 'PENDING_REVIEW' ELSE status END
       WHERE source_verified <> 1
    `);
  }

  const count = await postgres.query('SELECT COUNT(*)::int AS count FROM deals');
  if (count.rows[0].count === 0 && Array.isArray(db.tables.deals) && db.tables.deals.length) {
    for (const raw of db.tables.deals) {
      if (!shouldBootstrapDeal(raw)) continue;
      await upsert(raw, { skipEnsure: true });
    }
  }
  schemaReady = true;
}

function rowFromPg(row) {
  if (!row) return null;
  return normalizeRecord({ ...row, reviews: normalizeReviews(row.reviews) });
}

async function listAll() {
  if (!postgres.isConfigured()) return (db.tables.deals || []).map((d) => normalizeRecord(d));
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM deals ORDER BY created_at DESC');
  return result.rows.map(rowFromPg);
}

async function findByIdOrAsin(value) {
  const key = String(value || '').trim();
  if (!postgres.isConfigured()) {
    const row = (db.tables.deals || []).find((d) => d.id === key || d.asin === key);
    return row ? normalizeRecord(row) : null;
  }
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM deals WHERE id = $1 OR asin = $1 LIMIT 1', [key]);
  return rowFromPg(result.rows[0]);
}

async function upsert(input, options = {}) {
  const d = normalizeRecord(input);
  if (!d.id || !/^[A-Z0-9]{10}$/.test(d.asin) || !d.title) throw new Error('Invalid deal record');
  if (!(d.original_price > 0) || !(d.sale_price > 0) || d.sale_price > d.original_price) throw new Error('Invalid deal prices');
  d.discount_percent = Number((((d.original_price - d.sale_price) / d.original_price) * 100).toFixed(1));

  if (!postgres.isConfigured()) {
    const record = toJsonFallback(d);
    const index = db.tables.deals.findIndex((x) => x.id === d.id || x.asin === d.asin);
    if (index >= 0) db.tables.deals[index] = { ...db.tables.deals[index], ...record };
    else db.tables.deals.unshift(record);
    db.saveDb();
    return normalizeRecord(index >= 0 ? db.tables.deals[index] : record);
  }
  if (!options.skipEnsure) await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO deals (
      id, asin, title, category, original_price, sale_price, discount_percent,
      image_url, product_url, rating, ratings_total, quality_score, short_bio, full_summary,
      pros, cons, reviews, source_sufficient, source_verified, source_provider,
      status, is_expired, expired_at, price_check_at, last_verify_attempt_at, raw_source_data, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
    )
    ON CONFLICT (id) DO UPDATE SET
      asin=EXCLUDED.asin, title=EXCLUDED.title, category=EXCLUDED.category,
      original_price=EXCLUDED.original_price, sale_price=EXCLUDED.sale_price,
      discount_percent=EXCLUDED.discount_percent, image_url=EXCLUDED.image_url,
      product_url=EXCLUDED.product_url, rating=EXCLUDED.rating, ratings_total=EXCLUDED.ratings_total,
      quality_score=EXCLUDED.quality_score, short_bio=EXCLUDED.short_bio, full_summary=EXCLUDED.full_summary,
      pros=EXCLUDED.pros, cons=EXCLUDED.cons, reviews=EXCLUDED.reviews, source_sufficient=EXCLUDED.source_sufficient,
      source_verified=EXCLUDED.source_verified, source_provider=EXCLUDED.source_provider,
      status=EXCLUDED.status, is_expired=EXCLUDED.is_expired, expired_at=EXCLUDED.expired_at,
      price_check_at=EXCLUDED.price_check_at, last_verify_attempt_at=EXCLUDED.last_verify_attempt_at,
      raw_source_data=EXCLUDED.raw_source_data
    RETURNING *`,
    [
      d.id,d.asin,d.title,d.category||null,d.original_price,d.sale_price,d.discount_percent,
      d.image_url||null,d.product_url||null,d.rating,d.ratings_total,d.quality_score,d.short_bio||null,d.full_summary||null,
      d.pros||null,d.cons||null,JSON.stringify(d.reviews),d.source_sufficient,d.source_verified,d.source_provider||null,
      d.status||'PENDING_REVIEW',d.is_expired,d.expired_at,d.price_check_at,d.last_verify_attempt_at,d.raw_source_data||null,d.created_at
    ]
  );
  return rowFromPg(result.rows[0]);
}

async function update(value, changes) {
  const current = await findByIdOrAsin(value);
  if (!current) return null;
  return upsert({ ...current, ...changes, id: current.id, asin: changes.asin || current.asin, created_at: current.created_at });
}

async function remove(value) {
  const key = String(value || '');
  if (!postgres.isConfigured()) {
    const index = db.tables.deals.findIndex((d) => d.id === key || d.asin === key);
    if (index < 0) return false;
    db.tables.deals.splice(index, 1); db.saveDb(); return true;
  }
  await ensureSchema();
  const result = await postgres.query('DELETE FROM deals WHERE id = $1 OR asin = $1', [key]);
  return result.rowCount > 0;
}

async function expire(value, reason = 'Deal ended') {
  const d = await findByIdOrAsin(value);
  if (!d) return null;
  return update(d.id, {
    status: 'EXPIRED', is_expired: 1, expired_at: nowUnix(), price_check_at: nowUnix(),
    raw_source_data: `${d.raw_source_data || ''} | [EXPIRED: ${new Date().toISOString()} - ${reason}]`,
  });
}

async function restore(value) {
  const d = await findByIdOrAsin(value);
  if (!d || !isVerified(d)) return null;
  return update(d.id, { status: 'APPROVED', is_expired: 0, expired_at: null, price_check_at: nowUnix() });
}

async function bulkStatus(ids, status) {
  const set = new Set((ids || []).map(String));
  const all = await listAll();
  let updatedCount = 0;
  for (const d of all) {
    if (!set.has(d.id) && !set.has(d.asin)) continue;
    if (status === 'APPROVED' && !isVerified(d)) continue;
    const changes = { status };
    if (status === 'EXPIRED') { changes.is_expired = 1; changes.expired_at = nowUnix(); }
    else if (status === 'APPROVED') { changes.is_expired = 0; changes.expired_at = null; }
    await update(d.id, changes); updatedCount += 1;
  }
  return updatedCount;
}

async function approveAllVerified() {
  const all = await listAll();
  return bulkStatus(all.filter((d) => d.status === 'PENDING_REVIEW' && isVerified(d)).map((d) => d.id), 'APPROVED');
}

async function purgeExpired(maxAgeSeconds = 86400) {
  const threshold = nowUnix() - Number(maxAgeSeconds);
  if (!postgres.isConfigured()) {
    const before = db.tables.deals.length;
    const purgedDeals = db.tables.deals.filter((d) => (d.is_expired === 1 || d.status === 'EXPIRED') && d.expired_at && d.expired_at <= threshold);
    db.tables.deals = db.tables.deals.filter((d) => !purgedDeals.includes(d));
    if (purgedDeals.length) db.saveDb();
    return { purgedCount: before - db.tables.deals.length, purgedDeals: purgedDeals.map((d) => ({ id:d.id, asin:d.asin, title:d.title, expiredAt:d.expired_at })), remainingTotal: db.tables.deals.length };
  }
  await ensureSchema();
  const result = await postgres.query(`DELETE FROM deals WHERE (is_expired = 1 OR status = 'EXPIRED') AND expired_at IS NOT NULL AND expired_at <= $1 RETURNING id, asin, title, expired_at`, [threshold]);
  const remaining = await postgres.query('SELECT COUNT(*)::int AS count FROM deals');
  return { purgedCount: result.rowCount, purgedDeals: result.rows.map((d) => ({ id:d.id, asin:d.asin, title:d.title, expiredAt:d.expired_at })), remainingTotal: remaining.rows[0].count };
}

async function lifecycleStats() {
  const all = await listAll(); const now = nowUnix();
  const active = all.filter((d) => !d.is_expired && d.status === 'APPROVED');
  const pending = all.filter((d) => d.status === 'PENDING_REVIEW');
  const expired = all.filter((d) => d.is_expired === 1 || d.status === 'EXPIRED');
  return { total: all.length, activeCount: active.length, pendingCount: pending.length, expiredCount: expired.length, readyToPurgeCount: expired.filter((d) => d.expired_at && now - Number(d.expired_at) >= 86400).length, autoPurgeRule: 'Expired listings are automatically permanently deleted 24 hours after detection.' };
}

async function hardenProduction() {
  if (process.env.NODE_ENV !== 'production') return;
  const all = await listAll();
  for (const d of all) if (!isVerified(d) && (d.source_sufficient !== 0 || d.status === 'APPROVED')) await update(d.id, { source_sufficient: 0, status: d.status === 'APPROVED' ? 'PENDING_REVIEW' : d.status });
}

module.exports = { ensureSchema, listAll, findByIdOrAsin, upsert, update, remove, expire, restore, bulkStatus, approveAllVerified, purgeExpired, lifecycleStats, hardenProduction, normalizeRecord, isVerified, shouldBootstrapDeal };
