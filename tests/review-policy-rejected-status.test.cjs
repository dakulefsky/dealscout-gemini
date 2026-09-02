const test = require('node:test');
const assert = require('node:assert/strict');
const { publishingDecision } = require('../server/services/editorialCadenceService');

test('quality rejection maps directly to rejected status', () => {
  assert.deepEqual(publishingDecision({ asin: 'B012345678' }, { decision: 'REJECT' }), { status: 'REJECTED', reason: 'QUALITY_REJECT' });
});
