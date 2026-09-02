const test = require('node:test');
const assert = require('node:assert/strict');
const { getHoldbackPercent } = require('../server/services/editorialCadenceService');

test('explicit holdback config remains bounded', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  try {
    process.env.EDITORIAL_HOLDBACK_PERCENT = '150'; assert.equal(getHoldbackPercent(), 100);
    process.env.EDITORIAL_HOLDBACK_PERCENT = '-10'; assert.equal(getHoldbackPercent(), 0);
  } finally { if (old === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT; else process.env.EDITORIAL_HOLDBACK_PERCENT = old; }
});
