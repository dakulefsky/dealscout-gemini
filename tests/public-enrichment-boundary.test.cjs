const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('deal detail does not render legacy unproven enrichment fields', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');
  assert.equal(source.includes('deal.fullSummary'), false);
  assert.equal(source.includes('deal.shortBio'), false);
  assert.equal(source.includes('deal.pros'), false);
  assert.equal(source.includes('deal.cons'), false);
});

test('strict Rainforest adapter does not carry customer review content', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'rainforestStrictAdapter.js'), 'utf8');
  assert.equal(source.includes('reviews: []'), true);
  assert.equal(source.includes('top_reviews'), false);
  assert.equal(source.includes('normalizeReviews'), false);
});

test('live provider routing cannot fall back to legacy scraper metadata', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'providerRouter.js'), 'utf8');
  assert.equal(source.includes("require('./amazonScraperService')"), false);
  assert.equal(source.includes('resolveProductDetails'), false);
  assert.equal(source.includes("'curated'"), false);
  assert.equal(source.includes('Fail closed'), true);
});
