const test = require('node:test');
const assert = require('node:assert/strict');
const deals = require('../server/repositories/dealRepository');

function withNodeEnv(value, fn) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try { return fn(); }
  finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

test('production normalization cannot keep an unverified deal approved', () => {
  withNodeEnv('production', () => {
    const result = deals.normalizeRecord({
      id: 'B000000001', asin: 'B000000001', title: 'Demo',
      original_price: 100, sale_price: 80,
      source_verified: 0, source_sufficient: 1, status: 'APPROVED',
    });
    assert.equal(result.source_verified, 0);
    assert.equal(result.source_sufficient, 0);
    assert.equal(result.status, 'PENDING_REVIEW');
  });
});

test('verified production deals preserve approval', () => {
  withNodeEnv('production', () => {
    const result = deals.normalizeRecord({
      id: 'B000000002', asin: 'B000000002', title: 'Verified',
      original_price: 100, sale_price: 80,
      source_verified: 1, source_sufficient: 1, status: 'APPROVED',
    });
    assert.equal(result.source_verified, 1);
    assert.equal(result.source_sufficient, 1);
    assert.equal(result.status, 'APPROVED');
  });
});

test('production bootstrap imports only source-verified legacy deals', () => {
  withNodeEnv('production', () => {
    assert.equal(deals.shouldBootstrapDeal({ source_verified: 0 }), false);
    assert.equal(deals.shouldBootstrapDeal({ source_verified: 1 }), true);
  });
});

test('development bootstrap remains compatible with local demo data', () => {
  withNodeEnv('development', () => {
    assert.equal(deals.shouldBootstrapDeal({ source_verified: 0 }), true);
  });
});

test('review normalization rejects malformed or non-array review data', () => {
  const malformed = deals.normalizeRecord({ reviews: '{bad json' });
  const object = deals.normalizeRecord({ reviews: '{"text":"not an array"}' });
  const valid = deals.normalizeRecord({ reviews: '[{"rating":5}]' });
  assert.deepEqual(malformed.reviews, []);
  assert.deepEqual(object.reviews, []);
  assert.deepEqual(valid.reviews, [{ rating: 5 }]);
});
