const test = require('node:test');
const assert = require('node:assert/strict');

const { needsImageRepair } = require('../server/services/imageRepairService');

test('only active verified deals with missing or invalid images need repair', () => {
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 0, image_url: '' }), true);
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 0, image_url: 'not-a-url' }), true);
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 0, image_url: 'https://example.com/p.jpg' }), false);
  assert.equal(needsImageRepair({ source_verified: 0, is_expired: 0, image_url: '' }), false);
  assert.equal(needsImageRepair({ source_verified: 1, is_expired: 1, image_url: '' }), false);
});
