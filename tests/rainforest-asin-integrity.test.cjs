const test = require('node:test');
const assert = require('node:assert/strict');
const { requireMatchingAsin } = require('../server/services/rainforestStrictAdapter');

test('Rainforest product lookup accepts the requested ASIN', () => {
  assert.equal(requireMatchingAsin('b0gggqdy9h', 'B0GGGQDY9H'), 'B0GGGQDY9H');
});

test('Rainforest product lookup rejects a different returned ASIN', () => {
  assert.throws(
    () => requireMatchingAsin('B0GGGQDY9H', 'B012345678'),
    /ASIN mismatch/
  );
});
