const test = require('node:test');
const assert = require('node:assert/strict');
const { getHoldbackPercent } = require('../server/services/editorialCadenceService');

test('default holdback does not create arbitrary review work', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  delete process.env.EDITORIAL_HOLDBACK_PERCENT;
  assert.equal(getHoldbackPercent(), 0);
  if (old !== undefined) process.env.EDITORIAL_HOLDBACK_PERCENT = old;
});
