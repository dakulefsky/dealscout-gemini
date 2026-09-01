const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PUBLIC_PRICE_MAX_AGE_SECONDS,
  isPriceFresh,
  isPublicDeal,
  freshPriceThreshold,
} = require('../server/services/publicDealPolicy');

const NOW = 2_000_000;

function deal(overrides = {}) {
  return {
    status: 'APPROVED',
    is_expired: 0,
    source_verified: 1,
    price_check_at: NOW - 60,
    ...overrides,
  };
}

test('public price freshness window is 24 hours', () => {
  assert.equal(PUBLIC_PRICE_MAX_AGE_SECONDS, 24 * 60 * 60);
  assert.equal(isPriceFresh(deal(), NOW), true);
  assert.equal(isPriceFresh(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS }), NOW), true);
  assert.equal(isPriceFresh(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS - 1 }), NOW), false);
  assert.equal(isPriceFresh(deal({ price_check_at: NOW + 1 }), NOW), false);
  assert.equal(isPriceFresh(deal({ price_check_at: null }), NOW), false);
  assert.equal(freshPriceThreshold(NOW), NOW - PUBLIC_PRICE_MAX_AGE_SECONDS);
});

test('public deal policy fails closed for stale or non-public records', () => {
  assert.equal(isPublicDeal(deal(), { nowSeconds: NOW }), true);
  assert.equal(isPublicDeal(deal({ status: 'PENDING_REVIEW' }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ is_expired: 1 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ source_verified: 0 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS - 1 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ price_check_at: NOW + 1 }), { nowSeconds: NOW }), false);
});

test('shopper side surfaces use the shared public deal policy', () => {
  const root = path.join(__dirname, '..');
  const feed = fs.readFileSync(path.join(root, 'server/repositories/dealFeedRepository.js'), 'utf8');
  const bookmarks = fs.readFileSync(path.join(root, 'server/routes/bookmarks.js'), 'utf8');
  const ai = fs.readFileSync(path.join(root, 'server/routes/ai.js'), 'utf8');
  const seo = fs.readFileSync(path.join(root, 'server/services/seoService.js'), 'utf8');
  const integrity = fs.readFileSync(path.join(root, 'server/services/integrityHealthService.js'), 'utf8');

  assert.match(feed, /isPublicDeal/);
  assert.match(feed, /freshPriceThreshold/);
  assert.match(feed, /price_check_at IS NOT NULL AND price_check_at >=/);
  assert.match(feed, /price_check_at <=/);
  assert.match(bookmarks, /\.filter\(\(row\) => isPublicDeal\(row\)\)/);
  assert.match(ai, /if \(!isPublicDeal\(deal\)\)/);
  assert.match(seo, /PUBLIC_PRICE_MAX_AGE_SECONDS/);
  assert.match(seo, /noindex,follow/);
  assert.match(integrity, /PUBLIC_PRICE_MAX_AGE_SECONDS/);
});
