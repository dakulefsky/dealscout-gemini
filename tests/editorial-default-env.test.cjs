const test = require('node:test');
const assert = require('node:assert/strict');
const { requiresHumanEditorialReview } = require('../server/services/editorialCadenceService');

test('explicit sampling can still be enabled later', () => {
  const item = { asin: 'B0GGGQDY9H' };
  assert.equal(requiresHumanEditorialReview(item, 0), false);
  assert.equal(requiresHumanEditorialReview(item, 100), true);
});
