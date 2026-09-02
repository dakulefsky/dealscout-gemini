const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const querySource = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'bookmarkQueryRepository.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'bookmarks.js'), 'utf8');

test('PostgreSQL saved deals use one parameterized join with full public visibility guards', () => {
  assert.match(querySource, /FROM bookmarks b\s+JOIN deals d ON d\.id = b\.deal_id/s);
  assert.match(querySource, /WHERE b\.user_id = \$1/);
  assert.match(querySource, /d\.status = 'APPROVED'/);
  assert.match(querySource, /d\.source_verified = 1/);
  assert.match(querySource, /d\.is_expired <> 1/);
  assert.match(querySource, /d\.price_check_at IS NOT NULL/);
  assert.match(querySource, /d\.price_check_at >= \$2/);
  assert.match(querySource, /d\.price_check_at <= \$3/);
  assert.match(querySource, /freshPriceThreshold/);
  assert.match(querySource, /ORDER BY b\.created_at DESC/);
});

test('JSON fallback saved deals use the shared public deal policy', () => {
  assert.match(querySource, /const \{ isPublicDeal, freshPriceThreshold \} = require\('\.\.\/services\/publicDealPolicy'\)/);
  assert.match(querySource, /if \(!isPublicDeal\(deal\)\) return null/);
});

test('saved route no longer performs one deal lookup per bookmark', () => {
  assert.match(routeSource, /bookmarkQueries\.listPublicSavedDeals\(req\.clientIdentity\.id\)/);
  assert.doesNotMatch(routeSource, /for \(const bookmark of userBookmarks\)/);
  assert.doesNotMatch(routeSource, /findByIdOrAsin\(bookmark\.dealId\)/);
  assert.match(routeSource, /bookmark_created_at/);
  assert.match(routeSource, /bookmark_target_price/);
});
