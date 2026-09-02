const test = require('node:test');
const assert = require('node:assert/strict');
const { publishingDecision } = require('../server/services/editorialCadenceService');

test('quality lanes map to durable publication statuses', () => {
  assert.equal(publishingDecision({ asin: 'B012345678' }, { decision: 'REJECT' }).status, 'REJECTED');
  assert.equal(publishingDecision({ asin: 'B012345678' }, { decision: 'PENDING_REVIEW' }).status, 'PENDING_REVIEW');
});
