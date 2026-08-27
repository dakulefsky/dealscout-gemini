const {
  isKnownMachineEnrichment,
  hasLegacyEnrichment,
} = require('../server/services/legacyEnrichmentCleanupService');

describe('legacy enrichment cleanup selection', () => {
  test('selects explicit old machine/demo markers', () => {
    expect(isKnownMachineEnrichment({ source_provider: 'CURATED_DEMO' })).toBe(true);
    expect(isKnownMachineEnrichment({ raw_source_data: 'Gemini AI Ingest | ASIN: B0GGGQDY9H' })).toBe(true);
    expect(isKnownMachineEnrichment({ raw_source_data: 'RAINFOREST | AI-assisted editorial content | ASIN: B0GGGQDY9H' })).toBe(true);
  });

  test('does not select normal Rainforest or manual rows merely because they contain commentary', () => {
    expect(isKnownMachineEnrichment({ source_provider: 'RAINFOREST', raw_source_data: 'Rainforest API product lookup | ASIN: B0GGGQDY9H', pros: 'Legitimate note' })).toBe(false);
    expect(isKnownMachineEnrichment({ source_provider: 'MANUAL_VERIFIED', raw_source_data: 'Manual verified import', full_summary: 'Manual note' })).toBe(false);
  });

  test('detects stored legacy enrichment payloads', () => {
    expect(hasLegacyEnrichment({ pros: 'x' })).toBe(true);
    expect(hasLegacyEnrichment({ reviews: [{ text: 'x' }] })).toBe(true);
    expect(hasLegacyEnrichment({ short_bio: '', full_summary: '', pros: '', cons: '', reviews: [] })).toBe(false);
  });
});
