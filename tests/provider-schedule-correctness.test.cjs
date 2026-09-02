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

test('provider schedule uses a resettable one-shot timer', () => {
  assert.match(cronSource, /scheduleNextCycle\(delayMs = TWELVE_HOURS_MS\)/);
  assert.match(cronSource, /setTimeout\(async \(\) =>/);
  assert.match(cronSource, /if \(this\.intervalId\) this\.scheduleNextCycle\(\)/);
  assert.doesNotMatch(cronSource, /this\.intervalId = setInterval/);
});
