const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cronSource = fs.readFileSync(path.join(__dirname, '../server/services/cronService.js'), 'utf8');

test('manual discovery options are honored and bounded', () => {
  assert.match(cronSource, /async syncDailyDeals\(options = \{\}\)/);
  assert.match(cronSource, /const maxResults = boundedNumber\(options\.maxResults, 20, 1, 50\)/);
  assert.match(cronSource, /fetchDealsList\(\{ amazonDomain: 'amazon\.com', maxResults, minDiscount \}\)/);
});

test('provider scheduler polls with a resettable one-shot timer while PostgreSQL owns cadence', () => {
  assert.match(cronSource, /scheduleNextCycle\(delayMs = SCHEDULER_POLL_MS\)/);
  assert.match(cronSource, /setTimeout\(async \(\) =>/);
  assert.match(cronSource, /runFullCycle\(\{ scheduled: true \}\)/);
  assert.match(cronSource, /maintenanceCadence\.claim/);
  assert.doesNotMatch(cronSource, /this\.intervalId = setInterval/);
});
