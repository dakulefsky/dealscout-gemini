const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForDatabase } = require('../server/startup/databaseReadiness');

test('cold VPC connection failures recover before serving, without loosening connection bounds', async () => {
  let attempts = 0;
  const pauses = [];
  const result = await waitForDatabase({
    health: async () => ++attempts < 3
      ? { healthy: false, code: 'ETIMEDOUT', error: 'connect ETIMEDOUT' } : { healthy: true },
    sleep: async (ms) => pauses.push(ms), warn: () => {},
  });
  assert.equal(result.healthy, true);
  assert.equal(attempts, 3);
  assert.deepEqual(pauses, [3000, 3000]);
});

test('bad credentials, TLS and URL configuration fail immediately rather than retrying', async () => {
  for (const failure of [
    { code: '28P01', error: 'password authentication failed' },
    { code: 'CERT_HAS_EXPIRED', error: 'certificate has expired' },
    { error: 'DATABASE_URL must not override TLS' },
  ]) {
    let attempts = 0;
    await assert.rejects(waitForDatabase({
      health: async () => { attempts += 1; return { healthy: false, ...failure }; },
      sleep: async () => assert.fail('must not retry configuration failure'), warn: () => {},
    }), /PostgreSQL readiness check failed/);
    assert.equal(attempts, 1);
  }
});

test('permanent network failure stops at the startup budget', async () => {
  let clock = 0;
  let attempts = 0;
  await assert.rejects(waitForDatabase({
    health: async () => { attempts += 1; clock += 10000; return { healthy: false, error: 'Connection terminated due to connection timeout' }; },
    now: () => clock, sleep: async (ms) => { clock += ms; }, warn: () => {},
  }), /connection timeout/);
  assert.equal(attempts, 7);
  assert.equal(clock, 88000);
});
