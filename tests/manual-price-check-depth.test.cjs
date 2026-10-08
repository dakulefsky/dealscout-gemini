const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server/routes/functions.js'), 'utf8');

test('manual price verification requests one bounded batch per HTTP call', () => {
  assert.match(source, /requestedLimit = Math\.min\(6, Math\.max\(1, Number\(req\.body\?\.limit\) \|\| 6\)\)/);
  assert.match(source, /await dealCron\.checkDealPricesAndAvailability\(\{ maxChecks: requestedLimit \}\)/);
  assert.match(source, /result\?\.skipped && result\.reason === 'LOCK_HELD'[\s\S]*?status\(409\)/);
  assert.doesNotMatch(source, /while \(totals\.checkedCount < requestedLimit\)/);
});

test('manual verification reports the batch result to the admin client', () => {
  assert.match(source, /\.\.\.result,/);
  assert.match(source, /passes: 1,/);
});

test('manual verification scans past deals that are still in retry backoff', () => {
  const cron = fs.readFileSync(path.join(__dirname, '..', 'server/services/cronService.js'), 'utf8');
  assert.match(cron, /if \(scheduled\) \{\s*const claim = await this\.claimCadence\('verify-prices', JOB_INTERVALS\.verifyPrices, true\)/);
  assert.match(cron, /departmentVerificationQueue\(activeDeals,/);
  assert.match(cron, /Manual checks must not push the next scheduled daily verification out/);
});

test('manual price checks do not reset the next scheduled verification window', async () => {
  const cronService = require('../server/services/cronService');
  const deals = require('../server/repositories/dealRepository');
  const cadence = require('../server/repositories/maintenanceCadenceRepository');
  const postgres = require('../server/storage/postgres');
  const originals = {
    listAll: deals.listAll,
    claim: cadence.claim,
    markSucceeded: cadence.markSucceeded,
    withAdvisoryLock: postgres.withAdvisoryLock,
  };
  let cadenceClaims = 0;
  deals.listAll = async () => [];
  cadence.claim = async () => { cadenceClaims += 1; return { acquired: true }; };
  cadence.markSucceeded = async () => ({ last_succeeded_at: 1 });
  postgres.withAdvisoryLock = async (_lock, task) => ({ acquired: true, result: await task() });
  try {
    await cronService.checkDealPricesAndAvailability({ scheduled: false, maxChecks: 6 });
    assert.equal(cadenceClaims, 0);
  } finally {
    deals.listAll = originals.listAll;
    cadence.claim = originals.claim;
    cadence.markSucceeded = originals.markSucceeded;
    postgres.withAdvisoryLock = originals.withAdvisoryLock;
  }
});
