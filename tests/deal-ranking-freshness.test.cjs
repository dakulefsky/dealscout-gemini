const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function rankingModule() {
  const url = pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'dealRanking.js')).href;
  return import(url);
}

function baseDeal(overrides = {}) {
  return {
    id: 'B000000001',
    title: 'Verified deal',
    originalPrice: 100,
    salePrice: 70,
    discountPercent: 30,
    imageUrl: 'https://example.com/image.jpg',
    sourceVerified: true,
    qualityScore: 80,
    ...overrides,
  };
}

test('fresh verification materially outranks an otherwise identical stale deal', async () => {
  const { dealRankScore } = await rankingModule();
  const nowMs = Date.UTC(2026, 7, 28, 8, 0, 0);
  const nowSec = nowMs / 1000;
  const fresh = baseDeal({ priceCheckAt: nowSec - 3600 });
  const stale = baseDeal({ priceCheckAt: nowSec - (8 * 24 * 3600) });
  assert.ok(dealRankScore(fresh, nowMs) - dealRankScore(stale, nowMs) >= 30);
});

test('unchecked deals are penalized but not falsely expired', async () => {
  const { dealRankScore } = await rankingModule();
  const score = dealRankScore(baseDeal({ priceCheckAt: null }), Date.UTC(2026, 7, 28, 8, 0, 0));
  assert.ok(Number.isFinite(score));
  assert.notEqual(score, -Infinity);
});

test('expired deals remain excluded entirely', async () => {
  const { dealRankScore } = await rankingModule();
  assert.equal(dealRankScore(baseDeal({ status: 'EXPIRED' })), -Infinity);
});