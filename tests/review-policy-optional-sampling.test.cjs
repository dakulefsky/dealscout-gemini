const test = require('node:test');
const assert = require('node:assert/strict');
const { getHoldbackPercent } = require('../server/services/editorialCadenceService');

test('QA sampling can be explicitly configured without being default workload', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  process.env.EDITORIAL_HOLDBACK_PERCENT = '5';
  try { assert.equal(getHoldbackPercent(), 5); }
  finally { if (old === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT; else process.env.EDITORIAL_HOLDBACK_PERCENT = old; }
});
