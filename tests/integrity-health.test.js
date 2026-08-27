const { hasLegacyEnrichment, isMissingImage, isStalePrice } = require('../server/services/integrityHealthService');

describe('integrity health predicates', () => {
  test('detects legacy enrichment fields', () => {
    expect(hasLegacyEnrichment({ pros: 'Synthetic pro' })).toBe(true);
    expect(hasLegacyEnrichment({ full_summary: 'Generated summary' })).toBe(true);
    expect(hasLegacyEnrichment({ reviews: [{ text: 'x' }] })).toBe(true);
    expect(hasLegacyEnrichment({ pros: '', cons: '', reviews: [] })).toBe(false);
  });

  test('only flags missing images on active verified deals', () => {
    expect(isMissingImage({ source_verified: 1, is_expired: 0, image_url: '' })).toBe(true);
    expect(isMissingImage({ source_verified: 1, is_expired: 0, image_url: 'https://example.com/a.jpg' })).toBe(false);
    expect(isMissingImage({ source_verified: 0, is_expired: 0, image_url: '' })).toBe(false);
  });

  test('flags approved verified deals with stale or missing price checks', () => {
    const now = 2_000_000;
    expect(isStalePrice({ source_verified: 1, is_expired: 0, status: 'APPROVED', price_check_at: now - 90_000 }, now)).toBe(true);
    expect(isStalePrice({ source_verified: 1, is_expired: 0, status: 'APPROVED', price_check_at: now - 60 }, now)).toBe(false);
    expect(isStalePrice({ source_verified: 1, is_expired: 0, status: 'PENDING_REVIEW', price_check_at: 0 }, now)).toBe(false);
  });
});
