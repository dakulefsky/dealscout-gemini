const test = require('node:test');
const assert = require('node:assert/strict');
const { publishingDecision } = require('../server/services/editorialCadenceService');

test('auto-approved quality maps to approved status with zero sampling', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  process.env.EDITORIAL_HOLDBACK_PERCENT = '0';
  try { assert.equal(publishingDecision({ asin: 'B012345678' }, { decision: 'AUTO_APPROVE' }).status, 'APPROVED'); }
  finally { if (old === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT; else process.env.EDITORIAL_HOLDBACK_PERCENT = old; }
});
