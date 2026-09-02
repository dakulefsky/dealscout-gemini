const test = require('node:test');
const assert = require('node:assert/strict');
const { getHoldbackPercent } = require('../server/services/editorialCadenceService');

test('review queue is not populated by arbitrary sampling by default', () => {
  const previous = process.env.EDITORIAL_HOLDBACK_PERCENT;
  delete process.env.EDITORIAL_HOLDBACK_PERCENT;
  try { assert.equal(getHoldbackPercent(), 0); }
  finally { if (previous !== undefined) process.env.EDITORIAL_HOLDBACK_PERCENT = previous; }
});
