const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const querySource = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'bookmarkQueryRepository.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'bookmarks.js'), 'utf8');

test('PostgreSQL saved deals use one parameterized join with public visibility guards', () => {
  assert.match(querySource, /FROM bookmarks b\s+JOIN deals d ON d\.id = b\.deal_id/s);
  assert.match(querySource, /WHERE b\.user_id = \$1/);
  assert.match(querySource, /d\.status = 'APPROVED'/);
  assert.match(querySource, /d\.source_verified = 1/);
  assert.match(querySource, /d\.is_expired <> 1/);
  assert.match(querySource, /ORDER BY b\.created_at DESC/);
});

test('saved route no longer performs one deal lookup per bookmark', () => {
  assert.match(routeSource, /bookmarkQueries\.listPublicSavedDeals\(req\.clientIdentity\.id\)/);
  assert.doesNotMatch(routeSource, /for \(const bookmark of userBookmarks\)/);
  assert.doesNotMatch(routeSource, /findByIdOrAsin\(bookmark\.dealId\)/);
  assert.match(routeSource, /bookmark_created_at/);
  assert.match(routeSource, /bookmark_target_price/);
});
