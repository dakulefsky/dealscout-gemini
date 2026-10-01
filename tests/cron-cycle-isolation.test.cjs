const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('../server/services/cronService');

test('a failed maintenance lane does not skip the other scheduled work', async () => {
  const originals = {
    purge: cron.purgeOldExpiredDeals,
    discover: cron.syncDailyDeals,
    verify: cron.checkDealPricesAndAvailability,
    reschedule: cron.rescheduleAfterJobError,
  };
  const calls = [];
  const retries = [];
  cron.purgeOldExpiredDeals = async () => { calls.push('purge'); throw new Error('temporary cleanup failure'); };
  cron.syncDailyDeals = async () => { calls.push('discover'); return { created: 2, status: 'SUCCESS' }; };
  cron.checkDealPricesAndAvailability = async () => { calls.push('verify'); return { checkedCount: 4 }; };
  cron.rescheduleAfterJobError = async (...args) => { retries.push(args); };

  try {
    const result = await cron.runFullCycle({ scheduled: true });
    assert.deepEqual(calls, ['purge', 'discover', 'verify']);
    assert.equal(result.purge.status, 'NOTICE');
    assert.equal(result.discovery.created, 2);
    assert.equal(result.verification.checkedCount, 4);
    assert.equal(retries[0][0], 'purge-expired');
  } finally {
    cron.purgeOldExpiredDeals = originals.purge;
    cron.syncDailyDeals = originals.discover;
    cron.checkDealPricesAndAvailability = originals.verify;
    cron.rescheduleAfterJobError = originals.reschedule;
  }
});

test('a returned discovery notice is retried without hiding the cycle result', async () => {
  const originals = {
    purge: cron.purgeOldExpiredDeals,
    discover: cron.syncDailyDeals,
    verify: cron.checkDealPricesAndAvailability,
    reschedule: cron.rescheduleAfterJobError,
  };
  const retries = [];
  cron.purgeOldExpiredDeals = async () => ({ purgedCount: 0 });
  cron.syncDailyDeals = async () => ({ status: 'NOTICE', error: 'provider temporarily unavailable' });
  cron.checkDealPricesAndAvailability = async () => ({ checkedCount: 1 });
  cron.rescheduleAfterJobError = async (...args) => { retries.push(args); };

  try {
    const result = await cron.runFullCycle({ scheduled: true });
    assert.equal(result.discovery.status, 'NOTICE');
    assert.equal(result.verification.checkedCount, 1);
    assert.equal(retries[0][0], 'discover-deals');
    assert.equal(retries[0][1], 'provider temporarily unavailable');
  } finally {
    cron.purgeOldExpiredDeals = originals.purge;
    cron.syncDailyDeals = originals.discover;
    cron.checkDealPricesAndAvailability = originals.verify;
    cron.rescheduleAfterJobError = originals.reschedule;
  }
});
