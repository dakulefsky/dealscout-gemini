const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.AMAZON_ASSOCIATE_TAG = 'real-tag-20';
const { normalizeStrictPaapiItem, onlyRequestedAsins } = require('../server/services/amazonPaapiStrictAdapter');

function realItem(overrides = {}) {
  return {
    ASIN: 'B0GGGQDY9H',
    DetailPageURL: 'https://www.amazon.com/dp/B0GGGQDY9H?tag=wrong-tag-20&ref_=abc',
    ItemInfo: {
      Title: { DisplayValue: '  Real Product  ' },
      ByLineInfo: { Brand: { DisplayValue: 'Real Brand' } },
      Classifications: { ProductGroup: { DisplayValue: 'Electronics' } },
    },
    Images: { Primary: { Large: { URL: 'https://m.media-amazon.com/images/I/example.jpg' } } },
    Offers: { Listings: [{
      Price: { Amount: 79.99 },
      SavingBasis: { Amount: 99.99 },
      DeliveryInfo: { IsPrimeEligible: true },
      Availability: { Message: 'In Stock' },
    }] },
    ...overrides,
  };
}

test('strict PA-API normalization keeps only provider-supplied deal facts', () => {
  const item = normalizeStrictPaapiItem(realItem());
  assert.ok(item);
  assert.equal(item.title, 'Real Product');
  assert.equal(item.salePrice, 79.99);
  assert.equal(item.originalPrice, 99.99);
  assert.equal(item.imageUrl, 'https://m.media-amazon.com/images/I/example.jpg');
  assert.equal(item.rating, null);
  assert.equal(item.ratingsTotal, 0);
  assert.deepEqual(item.reviews, []);
  assert.equal(item.shortBio, '');
  assert.equal(item.fullSummary, '');
  assert.equal(item.pros, '');
  assert.equal(item.cons, '');
  assert.equal(item.sourceVerified, true);
});

test('PA-API product URLs always use the configured affiliate tag', () => {
  const item = normalizeStrictPaapiItem(realItem());
  const url = new URL(item.productUrl);
  assert.equal(url.hostname, 'www.amazon.com');
  assert.equal(url.searchParams.get('tag'), 'real-tag-20');
  assert.notEqual(url.searchParams.get('tag'), 'wrong-tag-20');
});

test('non-Amazon provider detail URLs cannot become stored product URLs', () => {
  const item = normalizeStrictPaapiItem(realItem({ DetailPageURL: 'https://evil.example/product/B0GGGQDY9H?tag=attacker' }));
  assert.ok(item);
  assert.equal(new URL(item.productUrl).hostname, 'www.amazon.com');
  assert.equal(new URL(item.productUrl).searchParams.get('tag'), 'real-tag-20');
  assert.equal(new URL(item.rawProductUrl).hostname, 'www.amazon.com');
});

test('strict PA-API normalization rejects missing or invented discount basis', () => {
  const base = {
    ASIN: 'B0GGGQDY9H',
    ItemInfo: { Title: { DisplayValue: 'Product' } },
    Offers: { Listings: [{ Price: { Amount: 79.99 } }] },
  };
  assert.equal(normalizeStrictPaapiItem(base), null);
  assert.equal(normalizeStrictPaapiItem({ ...base, Offers: { Listings: [{ Price: { Amount: 79.99 }, SavingBasis: { Amount: 79.99 } }] } }), null);
});

test('PA-API product lookups discard products whose ASIN was not requested', () => {
  const items = [
    { ASIN: 'B0GGGQDY9H' },
    { ASIN: 'B012345678' },
  ];
  assert.deepEqual(onlyRequestedAsins(items, ['B0GGGQDY9H']), [{ ASIN: 'B0GGGQDY9H' }]);
});

test('active PA-API routing cannot use synthetic legacy normalization', () => {
  const router = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'providerRouter.js'), 'utf8');
  assert.equal(router.includes("require('./amazonPaapiService')"), false);
  assert.equal(router.includes('strictGetItems'), true);
  assert.equal(router.includes('strictSearchItems'), true);

  const strictAdapter = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'amazonPaapiStrictAdapter.js'), 'utf8');
  assert.equal(strictAdapter.includes('unsplash.com'), false);
  assert.equal(strictAdapter.includes('1.25'), false);
  assert.equal(strictAdapter.includes('Verified Amazon Customer'), false);
  assert.equal(strictAdapter.includes('4.7'), false);
});
