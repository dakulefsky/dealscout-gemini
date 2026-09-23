const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('home leads with restrained department copy instead of explanatory personalization copy', () => {
  assert.match(home, /Departments/);
  assert.match(home, /15%+ off · recently checked/);
  assert.doesNotMatch(home, /quietly learns which categories|Good deals\. No digging/);
});

test('curated deal rows remain bounded and balanced where grids require it', () => {
  assert.match(home, /function balancedFeatured\(items, maxItems = 8\)/);
  assert.match(home, /const evenLength = bounded\.length - \(bounded\.length % 2\)/);
  assert.match(home, /balancedFeatured\(freshDealDrop\(visibleDeals\.filter/);
  assert.match(home, /balancedFeatured\(picks\.filter/);
});

test('Deal Drop headline stays terse', () => {
  assert.match(home, /Current/);
  assert.doesNotMatch(home, /worth seeing right now|A quick hit of the strongest verified deals/);
});
