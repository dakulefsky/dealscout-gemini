const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const shopperRouter = fs.readFileSync(path.join(root, 'server', 'routes', 'shopperApi.js'), 'utf8');
const apiCore = fs.readFileSync(path.join(root, 'src', 'lib', 'apiCore.js'), 'utf8');
const observation = fs.readFileSync(path.join(root, 'server', 'services', 'priceHistoryService.js'), 'utf8');

test('public price history remains removed from shopper routes and clients', () => {
  assert.doesNotMatch(shopperRouter, /priceHistory|price-history/);
  assert.doesNotMatch(apiCore, /getPriceHistory|price-history/);
});

test('verified observations are alert-only and retain no history query or storage contract', () => {
  assert.match(observation, /processPriceAlerts/);
  assert.doesNotMatch(observation, /getHistory|price_history|observed_at|source_provider|HISTORY_FILE|MAX_POINTS_PER_ASIN/i);
});
