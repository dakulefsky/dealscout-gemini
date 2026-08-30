const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isKnownMachineEnrichment,
  hasLegacyEnrichment,
} = require('../server/services/legacyEnrichmentCleanupService');

test('legacy enrichment cleanup selects explicit old machine/demo markers', () => {
  assert.equal(isKnownMachineEnrichment({ source_provider: 'CURATED_DEMO' }), true);
  assert.equal(isKnownMachineEnrichment({ raw_source_data: 'Gemini AI Ingest | ASIN: B0GGGQDY9H' }), true);
  assert.equal(isKnownMachineEnrichment({ raw_source_data: 'RAINFOREST | AI-assisted editorial content | ASIN: B0GGGQDY9H' }), true);
});

test('legacy enrichment cleanup does not select normal Rainforest or manual rows merely because they contain commentary', () => {
  assert.equal(isKnownMachineEnrichment({ source_provider: 'RAINFOREST', raw_source_data: 'Rainforest API product lookup | ASIN: B0GGGQDY9H', pros: 'Legitimate note' }), false);
  assert.equal(isKnownMachineEnrichment({ source_provider: 'MANUAL_VERIFIED', raw_source_data: 'Manual verified import', full_summary: 'Manual note' }), false);
});

test('legacy enrichment cleanup detects stored legacy enrichment payloads', () => {
  assert.equal(hasLegacyEnrichment({ pros: 'x' }), true);
  assert.equal(hasLegacyEnrichment({ reviews: [{ text: 'x' }] }), true);
  assert.equal(hasLegacyEnrichment({ short_bio: '', full_summary: '', pros: '', cons: '', reviews: [] }), false);
});
