const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dealDetail = fs.readFileSync(path.join(root, 'src', 'pages', 'DealDetail.jsx'), 'utf8');
const apiCore = fs.readFileSync(path.join(root, 'src', 'lib', 'apiCore.js'), 'utf8');
const shopperApi = fs.readFileSync(path.join(root, 'server', 'routes', 'shopperApi.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src', 'lib', 'api.js'), 'utf8');

test('observed price history is absent from both shopper API and deal page UI', () => {
  assert.doesNotMatch(apiCore, /getPriceHistory/);
  assert.doesNotMatch(shopperApi, /require\('\.\/priceHistory'\)/);
  assert.doesNotMatch(dealDetail, /getPriceHistory|Observed price history|observedPrices|priceHistory|historyLow|historyHigh/);
});

test('deal pages provide crawlable category links without inventing category slugs', () => {
  assert.match(dealDetail, /<nav aria-label="Breadcrumb"/);
  assert.match(dealDetail, /to=\{categoryPath\}/);
  assert.match(dealDetail, /return encodeURIComponent\(String\(value \|\| ''\)\.trim\(\)\)/);
  assert.doesNotMatch(dealDetail, /replace\(\/&\/g, 'and'\)/);
});

test('dead review sync client calls stay removed', () => {
  assert.doesNotMatch(api, /syncReviews/);
  assert.doesNotMatch(api, /rainforestReviews/);
  assert.doesNotMatch(api, /\/rainforest-reviews/);
});
