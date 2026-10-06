const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isPublicDeal, PUBLIC_MIN_DISCOUNT_PERCENT } = require('../server/services/publicDealPolicy');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function dealAt(discount) {
  const original = 100;
  const sale = original * (1 - discount / 100);
  return {
    status: 'APPROVED',
    is_expired: 0,
    source_verified: 1,
    original_price: original,
    sale_price: sale,
    price_check_at: Date.parse('2026-10-01T12:00:00Z') / 1000,
  };
}

test('public catalog has a hard 15 percent minimum discount', () => {
  assert.equal(PUBLIC_MIN_DISCOUNT_PERCENT, 15);
  assert.equal(isPublicDeal(dealAt(4.5), { nowSeconds: Date.parse('2026-10-01T12:00:00Z') / 1000 }), false);
  assert.equal(isPublicDeal(dealAt(14.9), { nowSeconds: Date.parse('2026-10-01T12:00:00Z') / 1000 }), false);
  assert.equal(isPublicDeal(dealAt(15), { nowSeconds: Date.parse('2026-10-01T12:00:00Z') / 1000 }), true);
  assert.equal(isPublicDeal(dealAt(30), { nowSeconds: Date.parse('2026-10-01T12:00:00Z') / 1000 }), true);
});

test('every SQL-backed public surface includes the minimum-discount gate', () => {
  for (const file of [
    'server/repositories/dealFeedRepository.js',
    'server/repositories/dealQueryRepository.js',
    'server/repositories/categoryRepository.js',
    'server/repositories/sitemapRepository.js',
    'server/repositories/bookmarkQueryRepository.js',
    'server/repositories/editorialRepository.js',
  ]) {
    assert.match(read(file), /minimumDiscountPercent/, file);
  }
});

test('verified refreshes expire deals once the discount drops below the floor', () => {
  const cron = read('server/services/cronService.js');
  const provider = read('server/services/providerRouter.js');
  assert.match(cron, /computedDiscount < minimumDiscountPercent/);
  assert.doesNotMatch(cron, /discount < 5/);
  assert.match(provider, /normalized\.discountPercent < minimumDiscountPercent/);
});

test('admin can find and permanently remove any verified deal', () => {
  const admin = read('src/pages/EditorialReview.jsx');
  const routes = read('server/routes/deals.js');
  assert.match(admin, /Search title or ASIN/);
  assert.match(admin, /dealsApi\.delete\(deal\.id \|\| deal\.asin\)/);
  assert.match(admin, /Remove Permanently/);
  assert.match(admin, /window\.confirm/);
  assert.match(routes, /await editorial\.remove\(current\.asin\)/);
  assert.match(routes, /res\.status\(404\)\.json\(\{ error: 'Deal not found' \}\)/);
});

test('manual approval cannot bypass the discount floor', () => {
  const routes = read('server/routes/deals.js');
  const quality = read('server/services/dealQualityService.js');
  assert.match(routes, /Approved deals must be at least/);
  assert.match(routes, /minimumDiscountPercent/);
  assert.match(quality, /discount < minimumDiscountPercent/);
});
