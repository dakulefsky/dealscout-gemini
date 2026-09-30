const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = fs.readFileSync(path.join(__dirname, '..', 'src/pages/Home.jsx'), 'utf8');
test('browsing supports scrolling and a keyboard-accessible Load more fallback', () => {
  assert.match(home, /new IntersectionObserver/);
  assert.match(home, /rootMargin: '700px 0px'/);
  assert.match(home, /Load more deals/);
  assert.match(home, /nextVisibleCount\(current, exploreDeals.length\)/);
  assert.match(home, /const hasMore = hasLocalMore \|\| Boolean\(nextCursor\)/);
});
test('featured inventory is excluded from the main grid only on the default homepage', () => {
  assert.match(home, /showCuratedHome \? visibleDeals.filter\(\(deal\) => !spotlightIds.has\(dealIdentity\(deal\)\)\) : visibleDeals/);
});
