const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const seo = require('../server/services/seoService');
const settings = require('../server/services/siteRuntimeSettingsService');
const { rowToDeal } = require('../server/services/publicDealDto');
const { compareUnitPrices, freshInitialFeed } = require('../shared/shoppingTools.mjs');

test('unit comparison handles different packs, ties and invalid inputs', () => {
  assert.deepEqual(compareUnitPrices(12, 6, 15, 10), { unitA: 2, unitB: 1.5, cheaper: 'B', savingPercent: 25 });
  assert.equal(compareUnitPrices(10, 5, 20, 10).cheaper, null);
  for (const invalid of ['', 0, -1, 'bad', Infinity]) assert.equal(compareUnitPrices(invalid, 2, 4, 2), null);
  assert.equal(compareUnitPrices(1e308, 1e-308, 4, 2), null);
});

test('initial feed is fresh, verified, approved and only seeds the matching default feed', () => {
  const now = 100000000;
  const deal = { status: 'APPROVED', sourceVerified: true, priceCheckAt: (now - 1000) / 1000, salePrice: 10, originalPrice: 20 };
  const page = { items: [deal], nextCursor: 'next' }, params = { sort: 'best' };
  assert.deepEqual(freshInitialFeed(page, params, now), page);
  for (const extra of [{ category: 'Baby' }, { q: 'camera' }, { sort: 'newest' }, { maxPrice: 25 }, { minDiscount: 50 }]) assert.equal(freshInitialFeed(page, { ...params, ...extra }, now).items.length, 0);
  for (const extra of [{ sourceVerified: false }, { status: 'REJECTED' }, { isExpired: true }, { priceCheckAt: (now + 1000) / 1000 }, { priceCheckAt: (now - 86400001) / 1000 }, { salePrice: 20 }]) assert.deepEqual(freshInitialFeed({ ...page, items: [{ ...deal, ...extra }] }, params, now), { items: [], nextCursor: null });
});

test('home bootstrap serialization preserves the public data firewall', () => {
  const row = { id: 'x', title: '</script><script>bad()</script>', original_price: 20, sale_price: 10, raw_source_data: 'secret', reviews: ['private'], rating: 5 };
  const data = JSON.stringify(rowToDeal(row)).replace(/</g, '\\u003c');
  assert.doesNotMatch(data, /<|secret|private|"rating"/);
  assert.equal(JSON.parse(data).title, row.title);
});

test('homepage identity connects the website to its organization', () => {
  const graph = seo.homeMeta('https://dealscouted.com').jsonLd['@graph'];
  const site = graph.find(node => node['@type'] === 'WebSite');
  const organization = graph.find(node => node['@type'] === 'Organization');
  assert.equal(site.publisher['@id'], organization['@id']);
  assert.ok(site.alternateName.includes('Dealscouted.com'));
  assert.equal(organization.url, 'https://dealscouted.com/');
  assert.match(seo.buildSitemap({ baseUrl: 'https://dealscouted.com' }), /<loc>https:\/\/dealscouted.com\/about<\/loc>/);
});

test('Search Console verification accepts only safe token content', async () => {
  await settings.set('google_site_verification', 'safe_Token-123');
  assert.equal((await settings.get('google_site_verification')).value, 'safe_Token-123');
  for (const token of ['<meta content="bad">', 'a" onload="bad', 'a'.repeat(257)]) await assert.rejects(settings.set('google_site_verification', token));
  const shell = '<head><title>Old</title><meta name="description" content="old" /></head>';
  assert.match(seo.replaceMeta(shell, { title: 'Title', description: 'Description', verificationToken: 'safe_Token-123' }), /name="google-site-verification" content="safe_Token-123"/);
  assert.doesNotMatch(seo.replaceMeta(shell, { title: 'Title', description: 'Description', verificationToken: '<bad>' }), /google-site-verification/);
  await settings.set('google_site_verification', '');
});

test('SEO settings require admin authorization and protect database error details', async () => {
  const routes = [];
  const admin = () => {};
  const router = { get: (...args) => routes.push(args), post: (...args) => routes.push(args) };
  const source = fs.readFileSync('server/routes/functions.js', 'utf8');
  const block = source.slice(source.indexOf("router.get('/seo-settings'"), source.indexOf("router.get('/provider-status'"));
  vm.runInNewContext(block, { router, requireAdmin: admin, require: () => ({ token: async () => { throw new Error('db password'); }, save: async () => { throw new Error('db password'); } }) });
  assert.equal(routes.length, 2);
  for (const route of routes) {
    assert.equal(route[1], admin);
    const response = { set() { return this; }, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
    await route[2]({ body: { token: 'token' } }, response);
    assert.equal(response.code, 503);
    assert.doesNotMatch(JSON.stringify(response.body), /password/);
  }
});

test('initial homepage HTML includes escaped product links, prices and departments', () => {
  const source = fs.readFileSync('server.js', 'utf8');
  const context = { require: path => require('../' + path.replace(/^\.\//, '')) };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeHtml'), source.indexOf('async function startServer')), context);
  const html = context.homeInitialContent([{ slug: 'baby', name: 'Baby' }], [{ id: 'abc', title: '<script>bad()</script>', sale_price: 12.5, category: 'Baby' }]);
  assert.match(html, /href="\/deal\/abc"/);
  assert.match(html, /\$12\.50/);
  assert.match(html, /href="\/category\/baby"/);
  assert.doesNotMatch(html, /<script>bad/);
  const deal = { title: 'Item', sale_price: 10, original_price: 20 };
  assert.doesNotMatch(context.dealInitialContent(deal, { is_human_pick: false, editorial_note: 'private draft' }), /private draft/);
  assert.match(context.dealInitialContent(deal, { is_human_pick: true, editorial_note: '<b>Useful note</b>' }), /&lt;b&gt;Useful note/);
});

test('failed homepage refresh preserves only a fresh matching initial feed', async () => {
  const source = fs.readFileSync('src/pages/Home.jsx', 'utf8');
  const start = source.indexOf('    const controller = new AbortController();');
  const end = source.indexOf('\n  }, [feedParams, searchQuery, retryNonce]);', start);
  const body = source.slice(start, end);
  const deal = { id: 'one', status: 'APPROVED', sourceVerified: true, priceCheckAt: Math.floor(Date.now() / 1000), salePrice: 10, originalPrice: 20 };
  for (const params of [{ sort: 'best' }, { sort: 'best', q: 'different product' }]) {
    let items, cursor, error, loading;
    const mocks = { AbortController, feedGeneration: { current: 0 }, paginationRequest: { current: null }, initialPage: { current: { items: [deal], nextCursor: 'next' } }, feedParams: params, freshInitialFeed, setLoading: value => { loading = value; }, setLoadingMore: () => {}, setError: value => { error = value; }, setDeals: value => { items = value; }, setNextCursor: value => { cursor = value; }, setVisibleCount: () => {}, INITIAL_FEED_SIZE: 12, window: { setTimeout: fn => { fn(); return 1; }, clearTimeout: () => {} }, searchQuery: params.q || '', dealsApi: { page: async () => { throw new Error('temporary outage'); } } };
    new Function(...Object.keys(mocks), body)(...Object.values(mocks));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(error, 'temporary outage');
    assert.equal(loading, false);
    assert.deepEqual(items, params.q ? [] : [deal]);
    assert.equal(cursor, params.q ? null : 'next');
  }
});
