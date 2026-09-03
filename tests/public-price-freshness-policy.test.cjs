const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PUBLIC_PRICE_MAX_AGE_SECONDS,
  hasValidPricePair,
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
    original_price: 100,
    sale_price: 70,
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

test('public price pairs must contain a real positive discount', () => {
  assert.equal(hasValidPricePair(deal()), true);
  assert.equal(hasValidPricePair(deal({ sale_price: 100 })), false);
  assert.equal(hasValidPricePair(deal({ sale_price: 110 })), false);
  assert.equal(hasValidPricePair(deal({ sale_price: 0 })), false);
  assert.equal(hasValidPricePair(deal({ original_price: 0 })), false);
  assert.equal(hasValidPricePair(deal({ original_price: null })), false);
});

test('public deal policy fails closed for stale, malformed or non-public records', () => {
  assert.equal(isPublicDeal(deal(), { nowSeconds: NOW }), true);
  assert.equal(isPublicDeal(deal({ status: 'PENDING_REVIEW' }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ is_expired: 1 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ source_verified: 0 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ sale_price: 100 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ sale_price: 110 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS - 1 }), { nowSeconds: NOW }), false);
  assert.equal(isPublicDeal(deal({ price_check_at: NOW + 1 }), { nowSeconds: NOW }), false);
});

test('shopper side surfaces use the shared public deal policy and SQL price guards', () => {
  const root = path.join(__dirname, '..');
  const feed = fs.readFileSync(path.join(root, 'server/repositories/dealFeedRepository.js'), 'utf8');
  const saved = fs.readFileSync(path.join(root, 'server/repositories/bookmarkQueryRepository.js'), 'utf8');
  const query = fs.readFileSync(path.join(root, 'server/repositories/dealQueryRepository.js'), 'utf8');
  const bookmarks = fs.readFileSync(path.join(root, 'server/routes/bookmarks.js'), 'utf8');
  const ai = fs.readFileSync(path.join(root, 'server/routes/ai.js'), 'utf8');
  const seo = fs.readFileSync(path.join(root, 'server/services/seoService.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'server/repositories/sitemapRepository.js'), 'utf8');
  const integrity = fs.readFileSync(path.join(root, 'server/services/integrityHealthService.js'), 'utf8');

  for (const source of [feed, saved, query, sitemap]) {
    assert.match(source, /sale_price > 0/);
    assert.match(source, /sale_price < (?:d\.)?original_price/);
  }
  assert.match(feed, /isPublicDeal/);
  assert.match(feed, /freshPriceThreshold/);
  assert.match(feed, /price_check_at IS NOT NULL AND price_check_at >=/);
  assert.match(feed, /price_check_at <=/);
  assert.match(bookmarks, /\.filter\(\(row\) => isPublicDeal\(row\)\)/);
  assert.match(ai, /if \(!isPublicDeal\(deal\)\)/);
  assert.match(seo, /PUBLIC_PRICE_MAX_AGE_SECONDS/);
  assert.match(seo, /noindex,follow/);
  assert.match(sitemap, /Math\.min\(requestedMaxAgeSeconds, PUBLIC_PRICE_MAX_AGE_SECONDS\)/);
  assert.match(sitemap, /price_check_at <= \$2/);
  assert.match(integrity, /PUBLIC_PRICE_MAX_AGE_SECONDS/);
});
