const test = require('node:test');
const assert = require('node:assert/strict');
const { oldestCheckedFirst, verificationAgeKey, attemptAgeKey } = require('../server/services/verificationQueue');

test('verification queue checks never-successfully-checked deals first', () => {
  const queue = oldestCheckedFirst([
    { id: 'recent', price_check_at: 200, last_verify_attempt_at: 200, created_at: 3 },
    { id: 'never', price_check_at: null, last_verify_attempt_at: 250, created_at: 2 },
    { id: 'old', price_check_at: 100, last_verify_attempt_at: 100, created_at: 1 },
  ], 3);
  assert.deepEqual(queue.map((d) => d.id), ['never', 'old', 'recent']);
});

test('failed attempts stay prioritized by the older successful price check', () => {
  const failed = { id: 'failed', price_check_at: 10, last_verify_attempt_at: 300 };
  const fresher = { id: 'fresher', price_check_at: 100, last_verify_attempt_at: 100 };
  assert.equal(verificationAgeKey(failed), 10);
  assert.equal(attemptAgeKey(failed), 300);
  assert.deepEqual(oldestCheckedFirst([failed, fresher], 2).map((d) => d.id), ['failed', 'fresher']);
  assert.equal(failed.price_check_at, 10);
});

test('last attempt only breaks ties between equally stale deals', () => {
  const queue = oldestCheckedFirst([
    { id: 'retried-recently', price_check_at: 50, last_verify_attempt_at: 300 },
    { id: 'retried-earlier', price_check_at: 50, last_verify_attempt_at: 200 },
  ], 2);
  assert.deepEqual(queue.map((d) => d.id), ['retried-earlier', 'retried-recently']);
});

test('verification queue respects the batch limit', () => {
  assert.equal(oldestCheckedFirst([{ id: 1 }, { id: 2 }, { id: 3 }], 2).length, 2);
});
