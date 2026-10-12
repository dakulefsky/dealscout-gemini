const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { freshScopedFeed, freshVerifiedDeals } = require('../shared/shoppingTools.mjs');
const now = 200000000;
const deal = { id: 'one', status: 'APPROVED', sourceVerified: true, priceCheckAt: now / 1000, salePrice: 10, originalPrice: 20 };

test('scoped fallback cannot seed another route or sort order', () => {
  const page = { scope: 'category/electronics', items: [deal], nextCursor: 'next' };
  assert.deepEqual(freshScopedFeed(page, page.scope, 'best', now), { items: [deal], nextCursor: 'next' });
  for (const [scope, sort] of [['category/baby', 'best'], ['collection/under-25', 'best'], ['', 'best'], [page.scope, 'price_asc']]) {
    assert.deepEqual(freshScopedFeed(page, scope, sort, now), { items: [], nextCursor: null });
  }
});

test('fallback discards stale, future, rejected, unverified and invalid-price offers', () => {
  const variants = [null, { ...deal, status: 'REJECTED' }, { ...deal, sourceVerified: false },
    { ...deal, isExpired: true }, { ...deal, priceCheckAt: now / 1000 + 1 },
    { ...deal, priceCheckAt: now / 1000 - 86401 }, { ...deal, salePrice: 0 },
    { ...deal, salePrice: 20 }, { ...deal, originalPrice: Infinity }, { ...deal, salePrice: NaN }];
  assert.deepEqual(freshVerifiedDeals([deal, ...variants], now), [deal]);
  assert.deepEqual(freshVerifiedDeals([deal], now + 86400001), []);
  assert.deepEqual(freshScopedFeed({ scope: 'category/electronics', items: variants, nextCursor: 'next' }, 'category/electronics', 'best', now), { items: [], nextCursor: null });
});

test('failed department metadata refresh preserves a fresh matching server page', async () => {
  const source = fs.readFileSync('src/pages/CategoryPage.jsx', 'utf8');
  const start = source.indexOf('    const controller = new AbortController();');
  const body = source.slice(start, source.indexOf('\n  }, [slug, sort, retryInitial]);', start));
  const current = { ...deal, priceCheckAt: Date.now() / 1000 };
  for (const slug of ['electronics', 'baby']) {
    let items, category, cursor, error, loading;
    const mocks = { AbortController, feedGeneration: { current: 0 }, paginationRequest: { current: null },
      initialPage: { current: { scope: 'category/electronics', category: { slug: 'electronics', name: 'Electronics' }, items: [current], nextCursor: 'next' } },
      slug, sort: 'best', serverSort: x => x, freshScopedFeed,
      setLoading: x => { loading = x; }, setLoadingMore: () => {}, setError: x => { error = x; }, setPaginationError: () => {},
      setCategory: x => { category = x; }, setDeals: x => { items = x; }, setNextCursor: x => { cursor = x; },
      setAllCategories: () => {}, categoriesApi: { list: async () => { throw new Error('temporary outage'); } }, dealsApi: { page: () => { throw new Error('should not request a mismatched category'); } } };
    new Function(...Object.keys(mocks), body)(...Object.values(mocks));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loading, false); assert.equal(error, 'temporary outage');
    assert.deepEqual(items, slug === 'electronics' ? [current] : []);
    assert.equal(cursor, slug === 'electronics' ? 'next' : null);
    assert.equal(category?.name || null, slug === 'electronics' ? 'Electronics' : null);
  }
});

test('failed collection refresh preserves matching offers without copying another collection', async () => {
  const source = fs.readFileSync('src/pages/DealCollection.jsx', 'utf8');
  const start = source.indexOf('    const controller = new AbortController();');
  const body = source.slice(start, source.indexOf('\n  }, [collection, slug, retry]);', start));
  const current = { ...deal, priceCheckAt: Date.now() / 1000 };
  for (const slug of ['under-25', 'under-50']) {
    let items, cursor, error, loading;
    const mocks = { AbortController, active: { current: null }, document: {}, collection: { name: 'Collection', filters: {} }, slug,
      initialPage: { current: { scope: 'collection/under-25', items: [current], nextCursor: 'next' } }, freshScopedFeed,
      setItems: x => { items = x; }, setCursor: x => { cursor = x; }, setLoading: x => { loading = x; }, setError: x => { error = x; }, setPaginationError: () => {},
      dealsApi: { page: async () => { throw new Error('temporary outage'); } } };
    new Function(...Object.keys(mocks), body)(...Object.values(mocks));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loading, false); assert.equal(error, true);
    assert.deepEqual(items, slug === 'under-25' ? [current] : []);
    assert.equal(cursor, slug === 'under-25' ? 'next' : null);
  }
});
