const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { encodeCursor, decodeCursor } = require('../server/services/dealCursor');

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
  assert.match(feedRepo, /const field = sort === 'discount_desc' \? DISCOUNT_SQL : 'sale_price'/);
  assert.match(feedRepo, /sort === 'discount_desc' \? derivedDiscount\(row\)/);
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
