const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const policy = require('../server/services/productTopicPolicy');
const seo = require('../server/services/seoService');
const collections = require('../shared/dealCollections.json');
const feed = require('../server/repositories/dealFeedRepository');
const db = require('../server/db');
const postgres = require('../server/storage/postgres');
const deals = require('../server/repositories/dealRepository');

test('product topics match actual products and exclude accessory listings', () => {
  const examples = {
    headphones: { yes: ['Bose QuietComfort Wireless Headphones with carrying case', 'Nothing Headphone (a), Bluetooth'], no: ['Headphone Stand', 'Replacement Ear Pads for Bose Headphones', 'Case for Sony Headphones', 'Bluetooth Speaker'] },
    'gaming-monitors': { yes: ['Dell 27 240Hz Gaming Monitor', 'Samsung Curved Gaming Monitor, 165Hz'], no: ['Gaming Monitor Stand', 'Mount for Gaming Monitor', 'Gaming Laptop', 'Office Monitor'] },
    'coffee-makers': { yes: ['Nespresso Coffee and Espresso Maker', 'Keurig Coffee Maker', 'Breville Espresso Machine'], no: ['Replacement Carafe for Coffee Maker', 'Paper Filters for Coffee Maker', 'Coffee Capsules for Espresso Machine', 'Coffee Table', 'Coffee Grinder'] },
  };
  for (const [type, group] of Object.entries(examples)) {
    for (const title of group.yes) assert.equal(policy.matchesProductType(type, title), true, title);
    for (const title of group.no) assert.equal(policy.matchesProductType(type, title), false, title);
  }
  assert.throws(() => feed.normalizeFilters({ productType: "headphones' OR true" }), /Invalid product type/);
});

test('topic sitemap matching respects category, title and exact price boundaries', () => {
  const headphone = collections.find(c => c.filters.productType === 'headphones');
  const deal = { title: 'Bose Headphones', category: 'Electronics', sale_price: 200, original_price: 300 };
  assert.equal(seo.collectionMatches(headphone, deal), true);
  for (const extra of [{ sale_price: 200.01 }, { category: 'Other' }, { title: 'Headphone Stand' }, { title: 'Wireless Speaker' }]) assert.equal(seo.collectionMatches(headphone, { ...deal, ...extra }), false);
  const nowMs = 1800000000000;
  const xml = seo.buildSitemap({ baseUrl: 'https://dealscouted.com', nowMs, deals: [{ ...deal, id: 'one', price_check_at: nowMs / 1000 }] });
  assert.match(xml, /\/deals\/headphone-deals-under-200/);
  assert.doesNotMatch(xml, /\/deals\/gaming-monitor-deals-under-200|\/deals\/coffee-maker-deals-under-150/);
  for (const check of [nowMs / 1000 - 86401, nowMs / 1000 + 1]) {
    const stale = seo.buildSitemap({ baseUrl: 'https://dealscouted.com', nowMs, deals: [{ ...deal, id: 'one', price_check_at: check }] });
    assert.doesNotMatch(stale, /\/deals\/headphone-deals-under-200/);
  }
});

test('topic filtering happens before paging and preserves public freshness safeguards', async () => {
  const original = db.tables.deals;
  const now = Math.floor(Date.now() / 1000);
  const row = (id, title, extra = {}) => ({ id, asin: id, title, category: 'Electronics', sale_price: 150, original_price: 300, quality_score: 80, created_at: now, price_check_at: now, source_verified: 1, status: 'APPROVED', is_expired: 0, ...extra });
  db.tables.deals = [
    ...Array.from({ length: 30 }, (_, i) => row(`A${String(i).padStart(9, '0')}`, `Headphone Stand ${i}`)),
    row('B000000001', 'Alpha Wireless Headphones'), row('B000000002', 'Beta Wireless Headphones'), row('B000000003', 'Gamma Wireless Headphones'),
    row('X000000001', 'Expired Headphones', { price_check_at: now - 86401 }),
    row('X000000002', 'Rejected Headphones', { status: 'REJECTED' }),
    row('X000000003', 'Unverified Headphones', { source_verified: 0 }),
    row('X000000004', 'Future Headphones', { price_check_at: now + 100 }),
  ];
  try {
    const options = { category: 'Electronics', productType: 'headphones', maxPrice: 200, sort: 'best', limit: 2 };
    const first = await feed.page(options);
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor);
    const second = await feed.page({ ...options, cursor: first.nextCursor });
    assert.equal(second.items.length, 1);
    assert.equal(second.nextCursor, null);
    assert.deepEqual([...first.items, ...second.items].map(row => row.id).sort(), ['B000000001', 'B000000002', 'B000000003']);
  } finally { db.tables.deals = original; }
});

test('PostgreSQL applies fixed bound topic predicates before quantity ranking and LIMIT', async () => {
  const original = { configured: postgres.isConfigured, query: postgres.query, schema: deals.ensureSchema };
  let captured;
  postgres.isConfigured = () => true;
  postgres.query = async (sql, params) => { captured = { sql, params }; return { rows: [] }; };
  deals.ensureSchema = async () => {};
  try {
    await feed.page({ category: 'Electronics', productType: 'headphones', maxPrice: 200, sort: 'best', limit: 2 });
    assert.match(captured.sql, /COALESCE\(title, ''\) ~\* \$3 AND COALESCE\(title, ''\) !~\* \$4/);
    assert.ok(captured.sql.indexOf('~* $3') < captured.sql.indexOf('quantity_offers AS'));
    assert.ok(captured.sql.indexOf('quantity_offers AS') < captured.sql.lastIndexOf('LIMIT'));
    assert.equal(captured.params[2], '\\yheadphones?\\y');
    assert.doesNotMatch(captured.sql, /headphones\?/);
    assert.equal(captured.params.at(-1), 3);
  } finally { postgres.isConfigured = original.configured; postgres.query = original.query; deals.ensureSchema = original.schema; }
});

test('topic collections are discoverable from server-rendered departments with useful buying notes', () => {
  const source = fs.readFileSync('server.js', 'utf8');
  const context = { require: path => require('../' + path.replace(/^\.\//, '')) };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeHtml'), source.indexOf('async function startServer')), context);
  const category = context.categoryInitialContent({ slug: 'electronics', name: 'Electronics', liveCount: 3 });
  assert.match(category, /href="\/deals\/headphone-deals-under-200"/);
  assert.match(category, /href="\/deals\/gaming-monitor-deals-under-200"/);
  const collection = collections.find(c => c.filters.productType === 'coffee-makers');
  const html = context.collectionInitialContent(collection, [{ id: 'one', title: 'Coffee Maker', sale_price: 100 }]);
  assert.match(html, /voltage/);
  assert.match(html, /compatible capsules/);
  assert.match(html, /href="\/deal\/one"/);
  const client = fs.readFileSync('src/pages/CategoryPage.jsx', 'utf8');
  assert.match(client, /departmentSlug === category.slug/);
});
