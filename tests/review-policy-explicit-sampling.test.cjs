const test = require('node:test');
const assert = require('node:assert/strict');
const { publishingDecision } = require('../server/services/editorialCadenceService');

test('explicit 100 percent QA sampling can still hold an auto-approved deal', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  process.env.EDITORIAL_HOLDBACK_PERCENT = '100';
  try { assert.equal(publishingDecision({ asin: 'B012345678' }, { decision: 'AUTO_APPROVE' }).status, 'PENDING_REVIEW'); }
  finally { if (old === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT; else process.env.EDITORIAL_HOLDBACK_PERCENT = old; }
});
