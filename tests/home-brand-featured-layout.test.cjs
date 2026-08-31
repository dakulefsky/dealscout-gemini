const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('home hero uses concise brand copy instead of explanatory personalization copy', () => {
  assert.match(home, /Good deals\. No digging\./);
  assert.match(home, /Freshly checked/);
  assert.doesNotMatch(home, /quietly learns which categories/);
});

test('prominent featured rows are trimmed to balanced even counts', () => {
  assert.match(home, /function balancedFeatured\(items, maxItems = 8\)/);
  assert.match(home, /const evenLength = bounded\.length - \(bounded\.length % 2\)/);
  assert.match(home, /balancedFeatured\(freshDealDrop\(visibleDeals, initialSeenDrop, 8\), 8\)/);
  assert.match(home, /balancedFeatured\(picks\.filter/);
});

test('Deal Drop headline stays brand-like rather than narrating dynamic counts', () => {
  assert.match(home, /Today’s best finds/);
  assert.doesNotMatch(home, /worth seeing right now/);
  assert.doesNotMatch(home, /A quick hit of the strongest verified deals/);
});
