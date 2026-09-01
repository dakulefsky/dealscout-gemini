const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { manualExpireChanges, manualRestoreChanges } = require('../server/services/manualDealLifecycle');
const routeSource = fs.readFileSync(path.join(__dirname, '..', 'server/routes/deals.js'), 'utf8');

test('manual expiry records lifecycle state without manufacturing price freshness', () => {
  const changes = manualExpireChanges({ raw_source_data: 'provider fact' }, 'manual test', 2_000_000);
  assert.equal(changes.status, 'EXPIRED');
  assert.equal(changes.is_expired, 1);
  assert.equal(changes.expired_at, 2_000_000);
  assert.match(changes.raw_source_data, /manual test/);
  assert.equal(Object.hasOwn(changes, 'price_check_at'), false);
});

test('manual restore reactivates a verified deal without advancing price freshness', () => {
  const changes = manualRestoreChanges();
  assert.deepEqual(changes, { status: 'APPROVED', is_expired: 0, expired_at: null });
  assert.equal(Object.hasOwn(changes, 'price_check_at'), false);
});

test('admin lifecycle routes use timestamp-neutral changes instead of verification helpers', () => {
  assert.match(routeSource, /deals\.update\(current\.id, manualExpireChanges\(current, reason\)\)/);
  assert.match(routeSource, /deals\.update\(current\.id, manualRestoreChanges\(\)\)/);
  assert.doesNotMatch(routeSource, /deals\.expire\(req\.params\.id/);
  assert.doesNotMatch(routeSource, /deals\.restore\(current\.id\)/);
});
