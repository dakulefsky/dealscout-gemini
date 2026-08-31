const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

async function loadModule(tag) {
  return import(`${pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'feedReturnLoop.js')).href}?${tag}=${Date.now()}`);
}

test('return-loop timestamp normalization handles seconds milliseconds and public created_date ISO strings', async () => {
  const helper = await loadModule('timestamps');
  assert.equal(helper.toEpochMilliseconds(2_000_000_000), 2_000_000_000_000);
  assert.equal(helper.toEpochMilliseconds(2_000_000_000_000), 2_000_000_000_000);
  assert.equal(helper.dealCreatedTimestampMs({ created_date: '2033-05-18T03:33:20.000Z' }), Date.parse('2033-05-18T03:33:20.000Z'));
});

test('freshness prefers successful price-check time and falls back to creation time', async () => {
  const helper = await loadModule('freshness');
  assert.equal(helper.dealFreshnessTimestampMs({ priceCheckAt: 2_000_000_000, created_date: '2020-01-01T00:00:00Z' }), 2_000_000_000_000);
  assert.equal(helper.dealFreshnessTimestampMs({ priceCheckAt: null, created_date: '2020-01-01T00:00:00Z' }), Date.parse('2020-01-01T00:00:00Z'));
});

test('Home preserves previous visit during the session and checkpoints on pagehide instead of mount', () => {
  assert.match(home, /const \[lastVisit\] = useState\(\(\) => loadPreviousVisit\(\)\)/);
  assert.match(home, /addEventListener\('pagehide', saveCheckpoint\)/);
  assert.match(home, /const saveCheckpoint = \(\) => checkpointVisit\(\)/);
  assert.doesNotMatch(home, /localStorage\.setItem\(LAST_VISIT_KEY, String\(Date\.now\(\)\)\)/);
});

test('return cue stays freshness-based without claiming every re-check is a new deal', () => {
  assert.match(home, /dealFreshnessTimestampMs\(deal\) > lastVisit/);
  assert.match(home, /Freshly refreshed deals are waiting/);
  assert.doesNotMatch(home, /new .*since your last visit/);
});

test('newest sorting uses the public created_date-compatible helper', () => {
  assert.match(home, /dealCreatedTimestampMs\(b\) - dealCreatedTimestampMs\(a\)/);
});
