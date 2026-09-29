const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { encodeCursor, decodeCursor } = require('../server/services/dealCursor');
const feed = require('../server/repositories/dealFeedRepository');
const db = require('../server/db');

const feedRepo = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'dealFeedRepository.js'), 'utf8');
const dealsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'deals.js'), 'utf8');

test('deal cursors round-trip as opaque base64url payloads and bind to sort order', () => {
  const cursor = encodeCursor({ sort: 'discount_desc', primary: 42.5, createdAt: 2_000_000_000, id: 'B000000001' });
  assert.doesNotMatch(cursor, /B000000001/);
  assert.deepEqual(decodeCursor(cursor, 'discount_desc'), {
    v: 1,
    sort: 'discount_desc',
    primary: 42.5,
    createdAt: 2_000_000_000,
    id: 'B000000001',
  });
  assert.equal(decodeCursor(cursor, 'price_asc'), null);
});

test('best sorting pages beyond the first page without rejecting its cursor', async () => {
  const original = db.tables.deals;
  const now = Math.floor(Date.now() / 1000);
  db.tables.deals = Array.from({ length: 26 }, (_, index) => ({
    id: `B${String(index).padStart(9, '0')}`,
    asin: `B${String(index).padStart(9, '0')}`,
    title: `Product ${index}`,
    original_price: 100,
    sale_price: 70,
    quality_score: index,
    created_at: now - index,
    price_check_at: now,
    source_verified: 1,
    is_expired: 0,
    status: 'APPROVED',
  }));
  try {
    const first = await feed.page({ sort: 'best', limit: 24 });
    assert.equal(first.items.length, 24);
    assert.ok(first.nextCursor);
    const second = await feed.page({ sort: 'best', limit: 24, cursor: first.nextCursor });
    assert.equal(second.items.length, 2);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 26);
  } finally {
    db.tables.deals = original;
  }
});

test('database numeric sort keys retain exact decimal precision in the cursor', () => {
  const primary = '46.12345678901234567890';
  const cursor = encodeCursor({ sort: 'best', primary, createdAt: 2_000_000_000, id: 'B000000001' });
  assert.equal(decodeCursor(cursor, 'best').primary, primary);
  assert.match(feedRepo, /row\.sort_score \?\? bestScore\(row\)/);
  assert.match(feedRepo, /params\.push\(cursor\.primary\)/);
});

test('feed ordering uses deterministic id tie-breakers for every supported sort', () => {
  assert.match(feedRepo, /\$\{DISCOUNT_SQL\} DESC, created_at DESC, id DESC/);
  assert.match(feedRepo, /sale_price ASC, created_at DESC, id DESC/);
  assert.match(feedRepo, /sale_price DESC, created_at DESC, id DESC/);
  assert.match(feedRepo, /created_at DESC, id DESC/);
});

test('cursor predicates are keyset based instead of offset pagination', () => {
  assert.match(feedRepo, /created_at < .*id < /s);
  assert.doesNotMatch(feedRepo, /OFFSET/i);
  assert.match(feedRepo, /limit \+ 1/);
});

test('feed discount filters and cursors use the price-derived expression', () => {
  assert.match(feedRepo, /const DISCOUNT_SQL = '\(100\.0 \* \(original_price - sale_price\) \/ original_price\)'/);
  assert.match(feedRepo, /filters\.minDiscount !== null\) where\.push\(`\$\{DISCOUNT_SQL\} >=/);
  assert.match(feedRepo, /const field = sort === 'best' \? BEST_SQL : sort === 'discount_desc' \? DISCOUNT_SQL : 'sale_price'/);
  assert.match(feedRepo, /row\.sort_score \?\? derivedDiscount\(row\)/);
});

test('feed filters remain parameterized before the cursor predicate', () => {
  assert.match(feedRepo, /LOWER\(COALESCE\(category, ''\)\) = LOWER\(\$\$\{params\.push\(filters\.category\)\}\)/);
  assert.match(feedRepo, /sale_price >= \$\$\{params\.push\(filters\.minPrice\)\}/);
  assert.match(feedRepo, /sale_price <= \$\$\{params\.push\(filters\.maxPrice\)\}/);
  assert.match(feedRepo, /COALESCE\(title, ''\) ILIKE/);
});

test('public cursor feed is a separate contract and rejects malformed cursors', () => {
  assert.match(dealsRoute, /router\.get\('\/feed'/);
  assert.match(dealsRoute, /Invalid feed cursor/);
  assert.match(dealsRoute, /nextCursor/);
});
