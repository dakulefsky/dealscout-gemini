const test = require('node:test');
const assert = require('node:assert/strict');
const { publishingDecision } = require('../server/services/editorialCadenceService');

test('automatic quality lane publishes directly when sampling is disabled', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  process.env.EDITORIAL_HOLDBACK_PERCENT = '0';
  try { assert.deepEqual(publishingDecision({ asin: 'B012345678' }, { decision: 'AUTO_APPROVE' }), { status: 'APPROVED', reason: 'AUTO_APPROVED' }); }
  finally { if (old === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT; else process.env.EDITORIAL_HOLDBACK_PERCENT = old; }
});
