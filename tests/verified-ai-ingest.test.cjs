const test = require('node:test');
const assert = require('node:assert/strict');
const { isAiIngest, normalizeVerifiedAiBody } = require('../server/middleware/verifiedAiIngestGuard');

test('detects legacy Gemini AI ingest payloads', () => {
  assert.equal(isAiIngest({ rawSourceData: 'Gemini AI Ingest | ASIN: B0GGGQDY9H' }), true);
  assert.equal(isAiIngest({ rawSourceData: 'RAINFOREST | ASIN: B0GGGQDY9H' }), false);
});

test('verified provider facts overwrite fabricated AI defaults and strip unproven enrichment', () => {
  const body = {
    asin: 'B0GGGQDY9H',
    title: 'AI guessed title',
    originalPrice: 99.99,
    salePrice: 79.99,
    imageUrl: 'https://example.com/fake.jpg',
    rating: 4.7,
    ratingsTotal: 1240,
    reviews: [{ text: 'fake' }],
    shortBio: 'AI editorial summary',
    fullSummary: 'AI-generated product overview',
    pros: ['Fake pro'],
    cons: ['Fake con'],
    rawSourceData: 'Gemini AI Ingest | ASIN: B0GGGQDY9H',
  };
  const live = {
    asin: 'B0GGGQDY9H',
    title: 'TCL 60 XE NXTPAPER 5G',
    originalPrice: 249.99,
    salePrice: 179.99,
    imageUrl: 'https://example.com/real.jpg',
    productUrl: 'https://www.amazon.com/dp/B0GGGQDY9H',
    rating: 4.1,
    ratingsTotal: 151,
    sourceVerified: true,
    sourceProvider: 'RAINFOREST',
  };
  const result = normalizeVerifiedAiBody(body, live);
  assert.equal(result.title, live.title);
  assert.equal(result.originalPrice, 249.99);
  assert.equal(result.salePrice, 179.99);
  assert.equal(result.imageUrl, live.imageUrl);
  assert.equal(result.sourceVerified, true);
  assert.equal(result.sourceProvider, 'RAINFOREST');
  assert.deepEqual(result.reviews, []);
  assert.equal(result.shortBio, '');
  assert.equal(result.fullSummary, '');
  assert.deepEqual(result.pros, []);
  assert.deepEqual(result.cons, []);
  assert.match(result.rawSourceData, /product verification only/i);
});

test('AI save fails closed without verified live data', () => {
  assert.throws(() => normalizeVerifiedAiBody({ asin: 'B0GGGQDY9H' }, null), /verified by a live product source/i);
  assert.throws(() => normalizeVerifiedAiBody({ asin: 'B0GGGQDY9H' }, { sourceVerified: true, asin: 'B0GGGQDY9H', title: 'x', originalPrice: 100, salePrice: 120 }), /valid original\/sale price pair/i);
});
