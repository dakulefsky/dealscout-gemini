const test = require('node:test');
const assert = require('node:assert/strict');
const seo = require('../server/services/seoService');
const collections = require('../shared/dealCollections.json');

test('collections use actual prices and savings at their boundaries', () => {
  assert.equal(seo.collectionMatches(collections[0], { sale_price: 25, original_price: 50 }), true);
  assert.equal(seo.collectionMatches(collections[0], { salePrice: 25.01, originalPrice: 50 }), false);
  assert.equal(seo.collectionMatches(collections[2], { sale_price: 50, original_price: 100, discount_percent: 5 }), true);
  assert.equal(seo.collectionMatches(collections[2], { sale_price: 51, original_price: 100, discount_percent: 90 }), false);
  assert.equal(seo.collectionMatches(collections[0], { sale_price: NaN, original_price: 100 }), false);
});

test('sitemap omits empty collections and stale or future price inventory', () => {
  const nowMs = 1800000000000;
  const deal = { id: 'ABC', sale_price: 20, original_price: 40, price_check_at: nowMs / 1000 };
  const xml = seo.buildSitemap({ baseUrl: 'https://dealscouted.com', deals: [deal], nowMs });
  for (const collection of collections) assert.ok(xml.includes('/deals/' + collection.slug));
  for (const age of [-1, 86401]) {
    const stale = seo.buildSitemap({ baseUrl: 'https://dealscouted.com', deals: [{ ...deal, price_check_at: nowMs / 1000 - age }], nowMs });
    assert.doesNotMatch(stale, /\/deals\/|\/deal\/ABC/);
  }
});

test('empty collections are noindex and active collections contain product links', () => {
  assert.equal(seo.collectionMeta('https://dealscouted.com', collections[0]).robots, 'noindex,follow');
  const meta = seo.collectionMeta('https://dealscouted.com', collections[0], [{ id: 'ABC', title: 'A & B' }]);
  assert.equal(meta.robots, 'index,follow');
  assert.equal(meta.jsonLd.mainEntity.itemListElement[0].url, 'https://dealscouted.com/deal/ABC');
});
