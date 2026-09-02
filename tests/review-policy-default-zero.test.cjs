const test = require('node:test');
const assert = require('node:assert/strict');
const { getHoldbackPercent } = require('../server/services/editorialCadenceService');

test('default random sampling is zero percent', () => {
  const old = process.env.EDITORIAL_HOLDBACK_PERCENT;
  delete process.env.EDITORIAL_HOLDBACK_PERCENT;
  try { assert.equal(getHoldbackPercent(), 0); }
  finally { if (old !== undefined) process.env.EDITORIAL_HOLDBACK_PERCENT = old; }
});
