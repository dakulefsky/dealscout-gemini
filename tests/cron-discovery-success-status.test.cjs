const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cron = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'cronService.js'), 'utf8');

test('lastRun is recorded only after a successful discovery pass', () => {
  const syncStart = cron.indexOf('async syncDailyDeals(options = {})');
  const fetchAt = cron.indexOf('const providerDeals = await fetchDealsList', syncStart);
  const lastRunAt = cron.indexOf('this.lastRun = new Date();', syncStart);
  const catchAt = cron.indexOf('} catch (err) {', fetchAt);

  assert.ok(syncStart >= 0);
  assert.ok(fetchAt > syncStart);
  assert.ok(lastRunAt > fetchAt, 'lastRun must not be stamped before the provider succeeds');
  assert.ok(lastRunAt < catchAt, 'lastRun must stay on the successful try path');
});

test('price observation warning no longer claims retained history', () => {
  assert.match(cron, /Price observation skipped:/);
  assert.doesNotMatch(cron, /Price history observation skipped:/);
});
