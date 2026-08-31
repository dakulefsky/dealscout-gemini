const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'apps', 'mobile', 'app', 'index.jsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'apps', 'mobile', 'src', 'components', 'DealCard.jsx'), 'utf8');
const personalization = fs.readFileSync(path.join(root, 'apps', 'mobile', 'src', 'personalization.js'), 'utf8');
const engagement = fs.readFileSync(path.join(root, 'apps', 'mobile', 'src', 'engagement.js'), 'utf8');

test('native engagement weights match the website shopper signals', () => {
  assert.match(home, /addCategoryInterest\(deal\.category, 2\)/);
  assert.match(home, /addCategoryInterest\(deal\.category, 4\)/);
  assert.match(home, /reduceCategoryInterest\(deal\.category, 3\)/);
  assert.match(personalization, /reduceInterest/);
});

test('native passive dwell is visibility-based and uses the shared thresholds', () => {
  assert.match(home, /itemVisiblePercentThreshold: 65/);
  assert.match(home, /onViewableItemsChanged/);
  assert.match(home, /dwellWeight\(Date\.now\(\) - startedAt\)/);
  assert.match(home, /dwellRecordedRef/);
  assert.doesNotMatch(card, /setTimeout|setInterval/);
});

test('not interested is a durable exact-deal hide with bounded lifetime', () => {
  assert.match(card, /Not interested/);
  assert.match(card, /onDismiss/);
  assert.match(engagement, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(engagement, /SecureStore\.setItemAsync\(DISMISSALS_KEY/);
  assert.match(home, /!dismissedIds\.has\(idOf\(deal\)\)/);
});

test('native return loop preserves the previous visit and makes only a freshness claim', () => {
  assert.match(home, /loadPreviousVisit\(\)/);
  assert.match(home, /checkpointVisit\(\)/);
  assert.match(home, /deals refreshed.*since your last visit/);
  assert.doesNotMatch(home, /new deals since your last visit/i);
  assert.match(engagement, /priceCheckAt/);
  assert.match(engagement, /created_date/);
});
