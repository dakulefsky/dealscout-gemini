const test = require('node:test');
const assert = require('node:assert/strict');
const { stableBucket, getHoldbackPercent, requiresHumanEditorialReview, publishingDecision } = require('../server/services/editorialCadenceService');

test('editorial bucket is deterministic by ASIN', () => {
  const first = stableBucket('B0GGGQDY9H');
  const second = stableBucket('b0gggqdy9h');
  assert.equal(first, second);
  assert.ok(first >= 0 && first <= 99);
});

test('random editorial holdback is disabled by default', () => {
  const previous = process.env.EDITORIAL_HOLDBACK_PERCENT;
  delete process.env.EDITORIAL_HOLDBACK_PERCENT;
  try { assert.equal(getHoldbackPercent(), 0); }
  finally { if (previous === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT; else process.env.EDITORIAL_HOLDBACK_PERCENT = previous; }
});

test('holdback can still be explicitly enabled for QA sampling', () => {
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

test('auto-approved deals publish directly by default', () => {
  const previous = process.env.EDITORIAL_HOLDBACK_PERCENT;
  delete process.env.EDITORIAL_HOLDBACK_PERCENT;
  try {
    assert.deepEqual(publishingDecision({ asin: 'B0GGGQDY9H' }, { decision: 'AUTO_APPROVE' }), { status: 'APPROVED', reason: 'AUTO_APPROVED' });
  } finally {
    if (previous === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT;
    else process.env.EDITORIAL_HOLDBACK_PERCENT = previous;
  }
});
