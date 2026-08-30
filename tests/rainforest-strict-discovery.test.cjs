const test = require('node:test');
const assert = require('node:assert/strict');

process.env.AMAZON_ASSOCIATE_TAG = 'dankul-20';
const { normalizeDeal, dedupeDeals, isUnavailableDeal } = require('../server/services/rainforestStrictDiscovery');

test('normalizes a real discounted Rainforest deal', () => {
  const deal = normalizeDeal({
    asin: 'B0GGGQDY9H',
    title: '  TCL 60 XE   NXTPAPER 5G  ',
    price: { value: 179.99 },
    rrp: { value: 249.99 },
    rating: 4.1,
    ratings_total: 151,
  });
  assert.ok(deal);
  assert.equal(deal.title, 'TCL 60 XE NXTPAPER 5G');
  assert.equal(deal.salePrice, 179.99);
  assert.equal(deal.originalPrice, 249.99);
  assert.equal(deal.discountPercent, 28);
  assert.equal(deal.sourceVerified, true);
  assert.match(deal.productUrl, /tag=dankul-20/);
  assert.deepEqual(deal.reviews, []);
});

test('rejects a deal without a real higher list price', () => {
  assert.equal(normalizeDeal({ asin: 'B0GGGQDY9H', title: 'No RRP', price: { value: 179.99 } }), null);
});

test('rejects malformed ASINs, blank titles, and non-discounts', () => {
  assert.equal(normalizeDeal({ asin: 'BAD', title: 'Bad ASIN', price: { value: 10 }, rrp: { value: 20 } }), null);
  assert.equal(normalizeDeal({ asin: 'B0GGGQDY9H', title: '   ', price: { value: 10 }, rrp: { value: 20 } }), null);
  assert.equal(normalizeDeal({ asin: 'B0GGGQDY9H', title: 'Not discounted', price: { value: 249.99 }, rrp: { value: 249.99 } }), null);
});

test('known unavailable discovery rows are filtered before they can consume result slots', () => {
  assert.equal(isUnavailableDeal({ availability: 'Currently unavailable' }), true);
  assert.equal(isUnavailableDeal({ availability: 'Temporarily out of stock' }), true);
  assert.equal(isUnavailableDeal({ availability: 'No featured offers available' }), true);
  assert.equal(isUnavailableDeal({ availability: 'In Stock' }), false);
});

test('deduplicates repeated ASINs and keeps the strongest observed deal', () => {
  const deals = [
    { asin: 'B0GGGQDY9H', discountPercent: 20, salePrice: 80 },
    { asin: 'B0GGGQDY9H', discountPercent: 30, salePrice: 70 },
    { asin: 'B012345678', discountPercent: 25, salePrice: 30 },
  ];
  const result = dedupeDeals(deals);
  assert.equal(result.length, 2);
  assert.equal(result.find((deal) => deal.asin === 'B0GGGQDY9H').discountPercent, 30);
});
