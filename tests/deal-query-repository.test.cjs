const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'server', 'repositories', 'dealQueryRepository.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'server', 'routes', 'deals.js'), 'utf8');

test('production deal list is filtered, sorted and limited in PostgreSQL', () => {
  assert.match(source, /SELECT \* FROM deals/);
  assert.match(source, /status = 'APPROVED'/);
  assert.match(source, /source_verified = 1/);
  assert.match(source, /sale_price < original_price/);
  assert.match(source, /ILIKE/);
  assert.match(source, /ORDER BY \$\{postgresOrder/);
  assert.match(source, /LIMIT \$\{limitPlaceholder\}/);
  assert.doesNotMatch(routes, /let list = await deals\.listAll\(\)/);
  assert.match(routes, /dealQueries\.list\(req\.query, \{ isAdmin \}\)/);
});

test('production public deal statistics derive average discount from the verified price pair', () => {
  assert.match(source, /COUNT\(\*\) FILTER/);
  assert.match(source, /AVG\(\$\{DISCOUNT_SQL\}\)/);
  assert.match(source, /COUNT\(DISTINCT category\)/);
  assert.match(source, /100\.0 \* \(original_price - sale_price\) \/ original_price/);
  assert.match(routes, /dealQueries\.stats\(\{ isAdmin \}\)/);
});

test('JSON fallback preserves public visibility, filters and sorting semantics', () => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    CLOUD_SQL_CONNECTION_NAME: process.env.CLOUD_SQL_CONNECTION_NAME,
  };
  delete process.env.DATABASE_URL;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;

  const { filterFallback } = require('../server/repositories/dealQueryRepository');
  const priceCheckAt = Math.floor(Date.now() / 1000) - 60;
  const rows = [
    { id: 'a', asin: 'A000000001', title: 'Speaker', category: 'Audio', status: 'APPROVED', is_expired: 0, source_verified: 1, price_check_at: priceCheckAt, discount_percent: 5, original_price: 60, sale_price: 40, created_at: 10 },
    { id: 'b', asin: 'B000000002', title: 'Headphones', category: 'Audio', status: 'APPROVED', is_expired: 0, source_verified: 0, price_check_at: priceCheckAt, discount_percent: 60, original_price: 50, sale_price: 20, created_at: 20 },
    { id: 'c', asin: 'C000000003', title: 'Lamp', category: 'Home', status: 'PENDING_REVIEW', is_expired: 0, source_verified: 1, price_check_at: priceCheckAt, discount_percent: 50, original_price: 20, sale_price: 10, created_at: 30 },
    { id: 'd', asin: 'D000000004', title: 'Cable', category: 'Audio', status: 'APPROVED', is_expired: 0, source_verified: 1, price_check_at: priceCheckAt, discount_percent: 90, original_price: 10, sale_price: 8, created_at: 40 },
  ];

  const publicRows = filterFallback(rows, { category: 'Audio', minDiscount: 10, sort: 'discount_desc', limit: 10 }, false);
  assert.deepEqual(publicRows.map((row) => row.id), ['a', 'd']);

  const adminRows = filterFallback(rows, { status: 'PENDING_REVIEW', q: 'lamp', limit: 10 }, true);
  assert.deepEqual(adminRows.map((row) => row.id), ['c']);

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('public discount filters and ordering use the price-derived SQL expression', () => {
  assert.match(source, /const DISCOUNT_SQL = '\(100\.0 \* \(original_price - sale_price\) \/ original_price\)'/);
  assert.match(source, /\$\{isAdmin \? 'discount_percent' : DISCOUNT_SQL\} >=/);
  assert.match(source, /\$\{isAdmin \? 'discount_percent' : DISCOUNT_SQL\} DESC/);
});

test('query construction remains parameterized for user-controlled filters', () => {
  assert.match(source, /function addParam/);
  assert.doesNotMatch(source, /WHERE.*\$\{opts\.q\}/);
  assert.doesNotMatch(source, /WHERE.*\$\{opts\.category\}/);
  assert.match(source, /addParam\(params, pattern\)/);
  assert.match(source, /addParam\(params, opts\.category\)/);
});
