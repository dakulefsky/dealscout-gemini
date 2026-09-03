const deals = require('./dealRepository');
const postgres = require('../storage/postgres');
const { isPublicDeal, freshPriceThreshold } = require('../services/publicDealPolicy');

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeOptions(options = {}) {
  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 100, 1), 100);
  return {
    ...options,
    q: typeof options.q === 'string' ? options.q.trim() : '',
    category: typeof options.category === 'string' ? options.category.trim() : '',
    status: typeof options.status === 'string' ? options.status.trim() : '',
    minDiscount: numberOrNull(options.minDiscount),
    minPrice: numberOrNull(options.minPrice),
    maxPrice: numberOrNull(options.maxPrice),
    minRating: numberOrNull(options.minRating),
    sort: options.sort || '-created_date',
    limit,
  };
}

function fallbackVisible(deal, isAdmin) {
  return isAdmin || isPublicDeal(deal);
}

function filterFallback(rows, options, isAdmin) {
  const opts = normalizeOptions(options);
  let list = rows.filter((deal) => fallbackVisible(deal, isAdmin));

  if (isAdmin && opts.status) list = list.filter((deal) => deal.status === opts.status);
  if (opts.category && opts.category !== 'All' && opts.category !== 'All Deals') {
    const category = opts.category.toLowerCase();
    list = list.filter((deal) => String(deal.category || '').toLowerCase() === category);
  }
  if (opts.q) {
    const term = opts.q.toLowerCase();
    list = list.filter((deal) => {
      const fields = isAdmin
        ? [deal.title, deal.short_bio, deal.full_summary, deal.asin, deal.category]
        : [deal.title, deal.asin, deal.category];
      return fields.some((value) => String(value || '').toLowerCase().includes(term));
    });
  }
  if (opts.minDiscount !== null) list = list.filter((deal) => Number(deal.discount_percent) >= opts.minDiscount);
  if (opts.minPrice !== null) list = list.filter((deal) => Number(deal.sale_price) >= opts.minPrice);
  if (opts.maxPrice !== null) list = list.filter((deal) => Number(deal.sale_price) <= opts.maxPrice);
  if (isAdmin && opts.minRating !== null) list = list.filter((deal) => Number(deal.rating) >= opts.minRating);

  if (opts.sort === 'discount_desc' || opts.sort === '-discount_percent') list.sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent));
  else if (opts.sort === 'price_asc') list.sort((a, b) => Number(a.sale_price) - Number(b.sale_price));
  else if (opts.sort === 'price_desc') list.sort((a, b) => Number(b.sale_price) - Number(a.sale_price));
  else if (isAdmin && opts.sort === 'rating_desc') list.sort((a, b) => Number(b.rating) - Number(a.rating));
  else list.sort((a, b) => Number(b.created_at) - Number(a.created_at));

  return list.slice(0, opts.limit);
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function postgresOrder(sort, isAdmin) {
  if (sort === 'discount_desc' || sort === '-discount_percent') return 'discount_percent DESC, created_at DESC';
  if (sort === 'price_asc') return 'sale_price ASC, created_at DESC';
  if (sort === 'price_desc') return 'sale_price DESC, created_at DESC';
  if (isAdmin && sort === 'rating_desc') return 'rating DESC, created_at DESC';
  return 'created_at DESC';
}

async function list(options = {}, { isAdmin = false } = {}) {
  const opts = normalizeOptions(options);
  if (!postgres.isConfigured()) return filterFallback(await deals.listAll(), opts, isAdmin);

  await deals.ensureSchema();
  const where = [];
  const params = [];

  if (isAdmin) {
    if (opts.status) where.push(`status = ${addParam(params, opts.status)}`);
  } else {
    const nowSeconds = Math.floor(Date.now() / 1000);
    where.push("status = 'APPROVED'");
    where.push('is_expired <> 1');
    where.push('source_verified = 1');
    where.push('original_price > 0');
    where.push('sale_price > 0');
    where.push('sale_price < original_price');
    where.push(`price_check_at IS NOT NULL AND price_check_at >= ${addParam(params, freshPriceThreshold(nowSeconds))}`);
    where.push(`price_check_at <= ${addParam(params, nowSeconds)}`);
  }

  if (opts.category && opts.category !== 'All' && opts.category !== 'All Deals') {
    where.push(`LOWER(COALESCE(category, '')) = LOWER(${addParam(params, opts.category)})`);
  }

  if (opts.q) {
    const pattern = `%${opts.q}%`;
    const placeholder = addParam(params, pattern);
    const searchable = isAdmin
      ? ['title', 'short_bio', 'full_summary', 'asin', 'category']
      : ['title', 'asin', 'category'];
    where.push(`(${searchable.map((field) => `COALESCE(${field}, '') ILIKE ${placeholder}`).join(' OR ')})`);
  }

  if (opts.minDiscount !== null) where.push(`discount_percent >= ${addParam(params, opts.minDiscount)}`);
  if (opts.minPrice !== null) where.push(`sale_price >= ${addParam(params, opts.minPrice)}`);
  if (opts.maxPrice !== null) where.push(`sale_price <= ${addParam(params, opts.maxPrice)}`);
  if (isAdmin && opts.minRating !== null) where.push(`rating >= ${addParam(params, opts.minRating)}`);

  const limitPlaceholder = addParam(params, opts.limit);
  const result = await postgres.query(
    `SELECT * FROM deals
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${postgresOrder(opts.sort, isAdmin)}
      LIMIT ${limitPlaceholder}`,
    params,
  );
  return result.rows.map(deals.normalizeRecord);
}

function aggregateFallback(rows, isAdmin) {
  const visible = rows.filter((deal) => fallbackVisible(deal, isAdmin));
  if (!isAdmin) {
    return {
      total: visible.length,
      approvedCount: visible.length,
      avgDiscount: visible.length ? Math.round(visible.reduce((sum, deal) => sum + Number(deal.discount_percent || 0), 0) / visible.length) : 0,
      categoriesCount: new Set(visible.map((deal) => deal.category).filter(Boolean)).size,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const approved = visible.filter((deal) => deal.status === 'APPROVED' && !deal.is_expired);
  const publicVisible = visible.filter((deal) => isPublicDeal(deal, { nowSeconds: now }));
  const pending = visible.filter((deal) => deal.status === 'PENDING_REVIEW');
  const expired = visible.filter((deal) => deal.is_expired === 1 || deal.status === 'EXPIRED');
  const rejected = visible.filter((deal) => deal.status === 'REJECTED');
  return {
    total: visible.length,
    approvedCount: approved.length,
    publicVisibleCount: publicVisible.length,
    pendingCount: pending.length,
    expiredCount: expired.length,
    rejectedCount: rejected.length,
    readyToPurgeCount: expired.filter((deal) => deal.expired_at && now - Number(deal.expired_at) >= 86400).length,
    avgDiscount: approved.length ? Math.round(approved.reduce((sum, deal) => sum + Number(deal.discount_percent || 0), 0) / approved.length) : 0,
    lifecycle: {
      total: visible.length,
      activeCount: approved.length,
      pendingCount: pending.length,
      expiredCount: expired.length,
      readyToPurgeCount: expired.filter((deal) => deal.expired_at && now - Number(deal.expired_at) >= 86400).length,
      autoPurgeRule: 'Expired listings are automatically permanently deleted 24 hours after detection.',
    },
  };
}

async function stats({ isAdmin = false } = {}) {
  if (!postgres.isConfigured()) return aggregateFallback(await deals.listAll(), isAdmin);
  await deals.ensureSchema();

  if (!isAdmin) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = await postgres.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*)::int AS approved_count,
        COALESCE(ROUND(AVG(discount_percent)), 0)::int AS avg_discount,
        COUNT(DISTINCT category)::int AS categories_count
      FROM deals
      WHERE status = 'APPROVED'
        AND is_expired <> 1
        AND source_verified = 1
        AND original_price > 0
        AND sale_price > 0
        AND sale_price < original_price
        AND price_check_at IS NOT NULL
        AND price_check_at >= $1
        AND price_check_at <= $2
    `, [freshPriceThreshold(nowSeconds), nowSeconds]);
    const row = result.rows[0];
    return {
      total: row.total,
      approvedCount: row.approved_count,
      avgDiscount: row.avg_discount,
      categoriesCount: row.categories_count,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const purgeThreshold = nowSeconds - 86400;
  const freshnessThreshold = freshPriceThreshold(nowSeconds);
  const result = await postgres.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'APPROVED' AND is_expired <> 1)::int AS approved_count,
      COUNT(*) FILTER (
        WHERE status = 'APPROVED'
          AND is_expired <> 1
          AND source_verified = 1
          AND original_price > 0
          AND sale_price > 0
          AND sale_price < original_price
          AND price_check_at IS NOT NULL
          AND price_check_at >= $2
          AND price_check_at <= $3
      )::int AS public_visible_count,
      COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending_count,
      COUNT(*) FILTER (WHERE is_expired = 1 OR status = 'EXPIRED')::int AS expired_count,
      COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_count,
      COUNT(*) FILTER (WHERE (is_expired = 1 OR status = 'EXPIRED') AND expired_at IS NOT NULL AND expired_at <= $1)::int AS ready_to_purge_count,
      COALESCE(ROUND(AVG(discount_percent) FILTER (WHERE status = 'APPROVED' AND is_expired <> 1)), 0)::int AS avg_discount
    FROM deals
  `, [purgeThreshold, freshnessThreshold, nowSeconds]);
  const row = result.rows[0];
  return {
    total: row.total,
    approvedCount: row.approved_count,
    publicVisibleCount: row.public_visible_count,
    pendingCount: row.pending_count,
    expiredCount: row.expired_count,
    rejectedCount: row.rejected_count,
    readyToPurgeCount: row.ready_to_purge_count,
    avgDiscount: row.avg_discount,
    lifecycle: {
      total: row.total,
      activeCount: row.approved_count,
      pendingCount: row.pending_count,
      expiredCount: row.expired_count,
      readyToPurgeCount: row.ready_to_purge_count,
      autoPurgeRule: 'Expired listings are automatically permanently deleted 24 hours after detection.',
    },
  };
}

module.exports = { list, stats, normalizeOptions, filterFallback, postgresOrder, aggregateFallback };
