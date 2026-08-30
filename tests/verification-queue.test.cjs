const test = require('node:test');
const assert = require('node:assert/strict');
const { oldestCheckedFirst, verificationAgeKey } = require('../server/services/verificationQueue');

test('verification queue checks never-attempted deals first', () => {
  const queue = oldestCheckedFirst([
    { id: 'recent', price_check_at: 200, last_verify_attempt_at: 200, created_at: 3 },
    { id: 'never', price_check_at: null, last_verify_attempt_at: null, created_at: 2 },
    { id: 'old', price_check_at: 100, last_verify_attempt_at: 100, created_at: 1 },
  ], 3);
  assert.deepEqual(queue.map((d) => d.id), ['never', 'old', 'recent']);
});

test('verification queue moves failed attempts back without pretending the price was checked', () => {
  const failed = { id: 'failed', price_check_at: 10, last_verify_attempt_at: 300 };
  const untouched = { id: 'untouched', price_check_at: 100, last_verify_attempt_at: 100 };
  assert.equal(verificationAgeKey(failed), 300);
  assert.deepEqual(oldestCheckedFirst([failed, untouched], 2).map((d) => d.id), ['untouched', 'failed']);
  assert.equal(failed.price_check_at, 10);
});

test('verification queue respects the batch limit', () => {
  assert.equal(oldestCheckedFirst([{ id: 1 }, { id: 2 }, { id: 3 }], 2).length, 2);
});
