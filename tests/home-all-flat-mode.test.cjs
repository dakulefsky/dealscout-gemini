const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('All is an explicit flat catalog mode', () => {
  assert.match(source, /searchParams\.get\('category'\) === 'all'/);
  assert.match(source, /setSearchParams\(\{ category: 'all'/);
  assert.match(source, /showCuratedHome = !flatAllMode && !hasActiveFilters/);
  assert.match(source, /\(flatAllMode \|\| hasActiveFilters\) \? visibleDeals/);
  assert.match(source, /flatAllMode \? 'All verified deals' : 'More deals for you'/);
});

test('flat All mode does not siphon deals into curated sections', () => {
  assert.match(source, /showCuratedHome \? balancedFeatured\(freshDealDrop/);
  assert.match(source, /showCuratedHome \? buildFeedChapters/);
  assert.match(source, /showCuratedHome && filteredPicks\.length > 0/);
});
