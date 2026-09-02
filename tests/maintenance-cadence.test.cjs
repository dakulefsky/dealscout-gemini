const test = require('node:test');
const assert = require('node:assert/strict');
const cadence = require('../server/repositories/maintenanceCadenceRepository');

test('scheduled maintenance claim is denied until durable due time', async () => {
  cadence.resetFallback();
  const first = await cadence.claim('discover-deals', 3600, { nowUnix: 1000 });
  const early = await cadence.claim('discover-deals', 3600, { nowUnix: 1500 });
  const due = await cadence.claim('discover-deals', 3600, { nowUnix: 4600 });
  assert.equal(first.acquired, true);
  assert.equal(first.state.next_due_at, 4600);
  assert.equal(early.acquired, false);
  assert.equal(early.state.next_due_at, 4600);
  assert.equal(due.acquired, true);
  assert.equal(due.state.next_due_at, 8200);
});

test('manual force claim resets next durable due time', async () => {
  cadence.resetFallback();
  await cadence.claim('verify-prices', 3600, { nowUnix: 1000 });
  const forced = await cadence.claim('verify-prices', 3600, { force: true, nowUnix: 1200 });
  assert.equal(forced.acquired, true);
  assert.equal(forced.state.next_due_at, 4800);
});
