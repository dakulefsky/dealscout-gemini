const test = require('node:test');
const assert = require('node:assert/strict');
const { requiresHumanEditorialReview } = require('../server/services/editorialCadenceService');

test('optional QA sampling remains deterministic when explicitly enabled', () => {
  const item = { asin: 'B012345678' };
  assert.equal(requiresHumanEditorialReview(item, 100), true);
  assert.equal(requiresHumanEditorialReview(item, 0), false);
});
