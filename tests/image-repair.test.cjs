const test = require('node:test');
const assert = require('node:assert/strict');

const { needsImageRepair, shouldStopImageRepair } = require('../server/services/imageRepairService');

test('only active verified deals with missing or invalid images need repair', () => {
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 0, image_url: '' }), true);
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 0, image_url: 'not-a-url' }), true);
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 0, image_url: 'https://example.com/p.jpg' }), false);
  assert.equal(needsImageRepair({ source_verified: 0, is_expired: 0, image_url: '' }), false);
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 1, image_url: '' }), false);
});

test('manual image repair stops after provider-wide budget or cooldown deferral', () => {
  assert.equal(shouldStopImageRepair({ code: 'PROVIDER_BUDGET_EXCEEDED' }), true);
  assert.equal(shouldStopImageRepair({ code: 'PROVIDER_COOLDOWN' }), true);
  assert.equal(shouldStopImageRepair({ code: 'ITEM_NOT_FOUND' }), false);
  assert.equal(shouldStopImageRepair(new Error('ordinary failure')), false);
});
