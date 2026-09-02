const test = require('node:test');
const assert = require('node:assert/strict');
const { publishingDecision } = require('../server/services/editorialCadenceService');

test('automatic approval is direct by default', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  delete process.env.EDITORIAL_HOLDBACK_PERCENT;
  try { assert.equal(publishingDecision({ asin: 'B012345678' }, { decision: 'AUTO_APPROVE' }).status, 'APPROVED'); }
  finally { if (old !== undefined) process.env.EDITORIAL_HOLDBACK_PERCENT = old; }
});
