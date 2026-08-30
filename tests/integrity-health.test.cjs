const test = require('node:test');
const assert = require('node:assert/strict');
const { hasLegacyEnrichment, isMissingImage, isStalePrice } = require('../server/services/integrityHealthService');

test('integrity health detects legacy enrichment fields', () => {
  assert.equal(hasLegacyEnrichment({ pros: 'Synthetic pro' }), true);
  assert.equal(hasLegacyEnrichment({ full_summary: 'Generated summary' }), true);
  assert.equal(hasLegacyEnrichment({ reviews: [{ text: 'x' }] }), true);
  assert.equal(hasLegacyEnrichment({ pros: '', cons: '', reviews: [] }), false);
});

test('integrity health only flags missing images on active verified deals', () => {
  assert.equal(isMissingImage({ source_verified: 1, is_expired: 0, image_url: '' }), true);
  assert.equal(isMissingImage({ source_verified: 1, is_expired: 0, image_url: 'https://example.com/a.jpg' }), false);
  assert.equal(isMissingImage({ source_verified: 0, is_expired: 0, image_url: '' }), false);
});

test('integrity health flags approved verified deals with stale or missing price checks', () => {
  const now = 2_000_000;
  assert.equal(isStalePrice({ source_verified: 1, is_expired: 0, status: 'APPROVED', price_check_at: now - 90_000 }, now), true);
  assert.equal(isStalePrice({ source_verified: 1, is_expired: 0, status: 'APPROVED', price_check_at: now - 60 }, now), false);
  assert.equal(isStalePrice({ source_verified: 1, is_expired: 0, status: 'PENDING_REVIEW', price_check_at: 0 }, now), false);
});
