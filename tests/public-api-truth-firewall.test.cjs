const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dealsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'deals.js'), 'utf8');
const functionsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'functions.js'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('public deal serializer excludes legacy enrichment and raw source data', () => {
  const publicBlock = dealsRoute.match(/const publicDeal = \{([\s\S]*?)\n  \};/);
  assert.ok(publicBlock, 'public serializer should define an explicit publicDeal allowlist');
  const text = publicBlock[1];
  for (const forbidden of ['rating:', 'ratingsTotal:', 'shortBio:', 'fullSummary:', 'pros:', 'cons:', 'reviews:', 'sourceProvider:', 'rawSourceData:']) {
    assert.doesNotMatch(text, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(text, /qualityScore:/);
  assert.match(text, /priceCheckAt:/);
});

test('internal fields are opt-in and only exposed to admin responses', () => {
  assert.match(dealsRoute, /function rowToDeal\(r, \{ includeInternal = false \} = \{\}\)/);
  assert.match(dealsRoute, /if \(!includeInternal\) return publicDeal;/);
  assert.match(dealsRoute, /includeInternal: req\.user\?\.role === 'admin'/);
  assert.match(dealsRoute, /includeInternal: isAdmin/);
});

test('public search and sorting do not use legacy ratings or enrichment', () => {
  assert.match(dealsRoute, /\? \(d\) => \[d\.title, d\.short_bio, d\.full_summary, d\.asin, d\.category\][\s\S]*?: \(d\) => \[d\.title, d\.asin, d\.category\]/);
  assert.match(dealsRoute, /if \(isAdmin && minRating/);
  assert.match(dealsRoute, /else if \(isAdmin && sort === 'rating_desc'\)/);
  assert.doesNotMatch(home, /d\.shortBio|d\.short_bio|d\.fullSummary|d\.full_summary/);
  assert.match(home, /d\.title\?\.toLowerCase\(\)\.includes\(term\)/);
  assert.match(home, /d\.category\?\.toLowerCase\(\)\.includes\(term\)/);
  assert.match(home, /d\.asin\?\.toLowerCase\(\)\.includes\(term\)/);
});

test('dead review sync routes and review imports are removed', () => {
  assert.doesNotMatch(dealsRoute, /sync-reviews/);
  assert.doesNotMatch(dealsRoute, /fetchProductReviews/);
  assert.doesNotMatch(functionsRoute, /rainforest-reviews/);
  assert.doesNotMatch(functionsRoute, /fetchProductReviews/);
  assert.doesNotMatch(functionsRoute, /searchProducts/);
});

test('verified provider ingest cannot persist provider-generated enrichment', () => {
  const recordBlock = functionsRoute.match(/function providerDealRecord[\s\S]*?\n\}/);
  assert.ok(recordBlock, 'providerDealRecord should exist');
  const text = recordBlock[0];
  assert.match(text, /rating: 0/);
  assert.match(text, /ratings_total: 0/);
  assert.match(text, /short_bio: ''/);
  assert.match(text, /full_summary: ''/);
  assert.match(text, /pros: ''/);
  assert.match(text, /cons: ''/);
  assert.match(text, /reviews: \[\]/);
  assert.doesNotMatch(text, /item\.shortBio|item\.fullSummary|item\.pros|item\.cons|item\.reviews/);
});