const test = require('node:test');
const assert = require('node:assert/strict');
const { getHoldbackPercent, publishingDecision } = require('../server/services/editorialCadenceService');

test('random editorial holdback is disabled by default', () => {
  const prior = process.env.EDITORIAL_HOLDBACK_PERCENT;
  delete process.env.EDITORIAL_HOLDBACK_PERCENT;
  try {
    assert.equal(getHoldbackPercent(), 0);
    assert.deepEqual(publishingDecision({ asin: 'B0GGGQDY9H' }, { decision: 'AUTO_APPROVE' }), { status: 'APPROVED', reason: 'AUTO_APPROVED' });
  } finally {
    if (prior === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT;
    else process.env.EDITORIAL_HOLDBACK_PERCENT = prior;
  }
});
