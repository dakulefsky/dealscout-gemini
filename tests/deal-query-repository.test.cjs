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
  assert.match(source, /ILIKE/);
  assert.match(source, /ORDER BY \$\{postgresOrder/);
  assert.match(source, /LIMIT \$\{limitPlaceholder\}/);
  assert.doesNotMatch(routes, /let list = await deals\.listAll\(\)/);
  assert.match(routes, /dealQueries\.list\(req\.query, \{ isAdmin \}\)/);
});

test('production deal statistics use aggregate SQL instead of full-table application scans', () => {
  assert.match(source, /COUNT\(\*\) FILTER/);
  assert.match(source, /AVG\(discount_percent\)/);
  assert.match(source, /COUNT\(DISTINCT category\)/);
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
    { id: 'a', asin: 'A000000001', title: 'Speaker', category: 'Audio', status: 'APPROVED', is_expired: 0, source_verified: 1, price_check_at: priceCheckAt, discount_percent: 30, sale_price: 40, created_at: 10 },
    { id: 'b', asin: 'B000000002', title: 'Headphones', category: 'Audio', status: 'APPROVED', is_expired: 0, source_verified: 0, price_check_at: priceCheckAt, discount_percent: 60, sale_price: 20, created_at: 20 },
    { id: 'c', asin: 'C000000003', title: 'Lamp', category: 'Home', status: 'PENDING_REVIEW', is_expired: 0, source_verified: 1, price_check_at: priceCheckAt, discount_percent: 50, sale_price: 10, created_at: 30 },
    { id: 'd', asin: 'D000000004', title: 'Cable', category: 'Audio', status: 'APPROVED', is_expired: 0, source_verified: 1, price_check_at: priceCheckAt, discount_percent: 15, sale_price: 8, created_at: 40 },
  ];

  const publicRows = filterFallback(rows, { category: 'Audio', minDiscount: 10, sort: 'price_asc', limit: 10 }, false);
  assert.deepEqual(publicRows.map((row) => row.id), ['d', 'a']);

  const adminRows = filterFallback(rows, { status: 'PENDING_REVIEW', q: 'lamp', limit: 10 }, true);
  assert.deepEqual(adminRows.map((row) => row.id), ['c']);

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('query construction remains parameterized for user-controlled filters', () => {
  assert.match(source, /function addParam/);
  assert.doesNotMatch(source, /WHERE.*\$\{opts\.q\}/);
  assert.doesNotMatch(source, /WHERE.*\$\{opts\.category\}/);
  assert.match(source, /addParam\(params, pattern\)/);
  assert.match(source, /addParam\(params, opts\.category\)/);
});
