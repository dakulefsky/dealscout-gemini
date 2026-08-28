const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dealDetail = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');

test('deal detail fetches and displays only observed price history', () => {
  assert.match(dealDetail, /dealsApi\.getPriceHistory\(dealId\)/);
  assert.match(dealDetail, /Observed price history/);
  assert.match(dealDetail, /History shows prices DealScout actually observed/);
  assert.match(dealDetail, /prices\.length >= 2/);
  assert.doesNotMatch(dealDetail, /simulated price history|estimated price history/i);
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