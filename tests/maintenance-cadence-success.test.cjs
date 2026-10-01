const test = require('node:test');
const assert = require('node:assert/strict');
const cadence = require('../server/repositories/maintenanceCadenceRepository');

test('durable cadence retains the last successful run across later failed attempts', async () => {
  cadence.resetFallback();
  const firstSuccess = 1_800_000_000;
  await cadence.claim('discover-deals', 43_200, { nowUnix: firstSuccess });
  await cadence.markSucceeded('discover-deals', firstSuccess + 12);

  const nextAttempt = firstSuccess + 43_200;
  await cadence.claim('discover-deals', 43_200, { nowUnix: nextAttempt });
  const state = await cadence.get('discover-deals');

  assert.equal(state.last_claimed_at, nextAttempt);
  assert.equal(state.last_succeeded_at, firstSuccess + 12);
  cadence.resetFallback();
});
