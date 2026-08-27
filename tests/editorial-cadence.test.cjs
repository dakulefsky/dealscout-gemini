const test = require('node:test');
const assert = require('node:assert/strict');
const { stableBucket, requiresHumanEditorialReview, publishingDecision } = require('../server/services/editorialCadenceService');

test('editorial bucket is deterministic by ASIN', () => {
  const first = stableBucket('B0GGGQDY9H');
  const second = stableBucket('b0gggqdy9h');
  assert.equal(first, second);
  assert.ok(first >= 0 && first <= 99);
});

test('holdback can be disabled or made universal', () => {
  const item = { asin: 'B0GGGQDY9H' };
  assert.equal(requiresHumanEditorialReview(item, 0), false);
  assert.equal(requiresHumanEditorialReview(item, 100), true);
});

test('quality rejection always wins over cadence', () => {
  const result = publishingDecision({ asin: 'B0GGGQDY9H' }, { decision: 'REJECT' });
  assert.deepEqual(result, { status: 'REJECTED', reason: 'QUALITY_REJECT' });
});

test('non-auto-approved quality stays pending', () => {
  const result = publishingDecision({ asin: 'B0GGGQDY9H' }, { decision: 'PENDING_REVIEW' });
  assert.deepEqual(result, { status: 'PENDING_REVIEW', reason: 'QUALITY_PENDING' });
});

test('auto-approved deals obey editorial holdback', () => {
  const held = publishingDecision({ asin: 'B0GGGQDY9H' }, { decision: 'AUTO_APPROVE' });
  assert.ok(['APPROVED', 'PENDING_REVIEW'].includes(held.status));
  assert.ok(['AUTO_APPROVED', 'EDITORIAL_HOLDBACK'].includes(held.reason));
});
