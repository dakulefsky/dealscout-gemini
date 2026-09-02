const test = require('node:test');
const assert = require('node:assert/strict');
const { publishingDecision } = require('../server/services/editorialCadenceService');

test('quality exception is labeled distinctly from optional sampling', () => {
  assert.deepEqual(publishingDecision({ asin: 'B012345678' }, { decision: 'PENDING_REVIEW' }), { status: 'PENDING_REVIEW', reason: 'QUALITY_PENDING' });
});
