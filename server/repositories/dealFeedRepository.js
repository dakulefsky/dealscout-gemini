const deals = require('./dealRepository');
const postgres = require('../storage/postgres');
const { encodeCursor, decodeCursor } = require('../services/dealCursor');
const { isPublicDeal, freshPriceThreshold } = require('../services/publicDealPolicy');

function normalizeSort(value) {
  if (value === 'discount_desc' || value === '-discount_percent') return 'discount_desc';
  if (value === 'price_asc') return 'price_asc';
  if (value === 'price_desc') return 'price_desc';
  return '-created_date';
}

function normalizeLimit(value) {
  return Math.min(Math.max(Number.parseInt(value, 10) || 24, 1), 50);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeFilters(options = {}) {
  return {
    q: typeof options.q === 'string' ? options.q.trim() : '',
    category: typeof options.category === 'string' ? options.category.trim() : '',
    minDiscount: numberOrNull(options.minDiscount),
    minPrice: numberOrNull(options.minPrice),
    maxPrice: numberOrNull(options.maxPrice),
  };
}

function cursorFromRow(row, sort) {
  const primary = sort === 'discount_desc'
    ? Number(row.discount_percent)
    : sort === 'price_asc' || sort === 'price_desc'
      ? Number(row.sale_price)
      : Number(row.created_at);
  return encodeCursor({ sort, primary, createdAt: row.created_at, id: row.id });
}

function orderBy(sort) {
  if (sort === 'discount_desc') return 'discount_percent DESC, created_at DESC, id DESC';
  if (sort === 'price_asc') return 'sale_price ASC, created_at DESC, id DESC';
  if (sort === 'price_desc') return 'sale_price DESC, created_at DESC, id DESC';
  return 'created_at DESC, id DESC';
}

function addCursorPredicate(where, params, cursor, sort) {
  if (!cursor) return;
  const created = `$${params.push(cursor.createdAt)}`;
  const id = `$${params.push(cursor.id)}`;
  if (sort === '-created_date') {
    where.push(`(created_at < ${created} OR (created_at = ${created} AND id < ${id}))`);
    return;
  }
  const primary = `$${params.push(Number(cursor.primary))}`;
  const field = sort === 'discount_desc' ? 'discount_percent' : 'sale_price';
  const op = sort === 'price_asc' ? '>' : '<';
  where.push(`(${field} ${op} ${primary} OR (${field} = ${primary} AND (created_at < ${created} OR (created_at = ${created} AND id < ${id}))))`);
}

function filterFallback(rows, filters) {
  return rows.filter((deal) => {
    if (filters.category && String(deal.category || '').toLowerCase() !== filters.category.toLowerCase()) return false;
    if (filters.q) {
      const term = filters.q.toLowerCase();
      if (![deal.title, deal.asin, deal.category].some((value) => String(value || '').toLowerCase().includes(term))) return false;
    }
    if (filters.minDiscount !== null && Number(deal.discount_percent) < filters.minDiscount) return false;
    if (filters.minPrice !== null && Number(deal.sale_price) < filters.minPrice) return false;
    if (filters.maxPrice !== null && Number(deal.sale_price) > filters.maxPrice) return false;
    return true;
  });
}

function fallbackSort(rows, sort) {
  return rows.sort((a, b) => {
    const createdDiff = Number(b.created_at) - Number(a.created_at);
    const idDiff = String(b.id).localeCompare(String(a.id));
    if (sort === 'discount_desc') return Number(b.discount_percent) - Number(a.discount_percent) || createdDiff || idDiff;
    if (sort === 'price_asc') return Number(a.sale_price) - Number(b.sale_price) || createdDiff || idDiff;
    if (sort === 'price_desc') return Number(b.sale_price) - Number(a.sale_price) || createdDiff || idDiff;
    return createdDiff || idDiff;
  });
}

function afterCursor(row, cursor, sort) {
  if (!cursor) return true;
  const created = Number(row.created_at);
  if (sort === '-created_date') return created < cursor.createdAt || (created === cursor.createdAt && String(row.id) < cursor.id);
  const value = sort === 'discount_desc' ? Number(row.discount_percent) : Number(row.sale_price);
  const primary = Number(cursor.primary);
  const primaryAfter = sort === 'price_asc' ? value > primary : value < primary;
  return primaryAfter || (value === primary && (created < cursor.createdAt || (created === cursor.createdAt && String(row.id) < cursor.id)));
}

async function page(options = {}) {
  const sort = normalizeSort(options.sort);
  const limit = normalizeLimit(options.limit);
  const filters = normalizeFilters(options);
  const cursor = decodeCursor(options.cursor, sort);
  if (options.cursor && !cursor) throw new Error('Invalid cursor');

  if (!postgres.isConfigured()) {
    let rows = (await deals.listAll()).filter((deal) => isPublicDeal(deal));
    rows = filterFallback(rows, filters);
    rows = fallbackSort(rows, sort).filter((row) => afterCursor(row, cursor, sort));
    const selected = rows.slice(0, limit + 1);
    const hasMore = selected.length > limit;
    const items = selected.slice(0, limit);
    return { items, nextCursor: hasMore ? cursorFromRow(items.at(-1), sort) : null };
  }

  await deals.ensureSchema();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const params = [];
  const freshness = `$${params.push(freshPriceThreshold(nowSeconds))}`;
  const now = `$${params.push(nowSeconds)}`;
  const where = [
    "status = 'APPROVED'",
    'is_expired <> 1',
    'source_verified = 1',
    'original_price > 0',
    'sale_price > 0',
    'sale_price < original_price',
    `price_check_at IS NOT NULL AND price_check_at >= ${freshness} AND price_check_at <= ${now}`,
  ];
  if (filters.category) where.push(`LOWER(COALESCE(category, '')) = LOWER($${params.push(filters.category)})`);
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const placeholder = `$${params.push(pattern)}`;
    where.push(`(COALESCE(title, '') ILIKE ${placeholder} OR COALESCE(asin, '') ILIKE ${placeholder} OR COALESCE(category, '') ILIKE ${placeholder})`);
  }
  if (filters.minDiscount !== null) where.push(`discount_percent >= $${params.push(filters.minDiscount)}`);
  if (filters.minPrice !== null) where.push(`sale_price >= $${params.push(filters.minPrice)}`);
  if (filters.maxPrice !== null) where.push(`sale_price <= $${params.push(filters.maxPrice)}`);
  addCursorPredicate(where, params, cursor, sort);
  params.push(limit + 1);
  const result = await postgres.query(`
    SELECT * FROM deals
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy(sort)}
     LIMIT $${params.length}
  `, params);
  const hasMore = result.rows.length > limit;
  const rows = result.rows.slice(0, limit);
  return {
    items: rows.map(deals.normalizeRecord),
    nextCursor: hasMore && rows.length ? cursorFromRow(rows.at(-1), sort) : null,
  };
}

module.exports = { page, normalizeSort, normalizeLimit, normalizeFilters, orderBy };
