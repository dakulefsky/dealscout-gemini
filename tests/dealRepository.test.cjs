const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const deals = require('../server/repositories/dealRepository');

const repositorySource = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'dealRepository.js'), 'utf8');

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return fn(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('production normalization cannot keep an unverified deal approved', () => {
  withEnv({ NODE_ENV: 'production' }, () => {
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
  withEnv({ NODE_ENV: 'production' }, () => {
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

test('canonical identity accepts raw ASINs and common Amazon URLs', () => {
  assert.equal(deals.canonicalIdentity('b000000003'), 'B000000003');
  assert.equal(deals.canonicalIdentity('https://www.amazon.com/dp/B000000004/ref=something'), 'B000000004');
  assert.equal(deals.canonicalIdentity('https://amazon.com/gp/product/b000000005?tag=x'), 'B000000005');
});

test('valid ASIN becomes both repository id and asin', () => {
  const normalized = deals.normalizeRecord({
    id: 'legacy-row-id',
    asin: 'https://www.amazon.com/dp/B000000006/ref=abc',
    title: 'Canonical',
  });
  assert.equal(normalized.asin, 'B000000006');
  assert.equal(normalized.id, 'B000000006');
});

test('PostgreSQL upsert converges conflicts on ASIN and canonicalizes the primary id', () => {
  assert.match(repositorySource, /ON CONFLICT \(asin\) DO UPDATE SET/);
  assert.match(repositorySource, /id=EXCLUDED\.id/);
  assert.doesNotMatch(repositorySource, /ON CONFLICT \(id\) DO UPDATE SET/);
});

test('production bootstrap never imports legacy seed, even if demo flag is set', () => {
  withEnv({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' }, () => {
    assert.equal(deals.shouldBootstrapDeal({ source_verified: 0 }), false);
    assert.equal(deals.shouldBootstrapDeal({ source_verified: 1 }), false);
  });
});

test('development bootstrap requires explicit demo flag', () => {
  withEnv({ NODE_ENV: 'development', ALLOW_DEMO_SEED: undefined }, () => {
    assert.equal(deals.shouldBootstrapDeal({ source_verified: 0 }), false);
  });
  withEnv({ NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' }, () => {
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
