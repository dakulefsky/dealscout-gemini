const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');

test('Home uses the versioned cursor feed instead of fetching a fixed catalog batch', () => {
  assert.match(api, /const SHOPPER_API = '\/api\/v1'/);
  assert.match(api, /page: \(params = \{\}, options\) =>/);
  assert.match(api, /`\$\{SHOPPER_API\}\/deals\/feed/);
  assert.match(home, /dealsApi\.page\(feedParams/);
  assert.doesNotMatch(home, /dealsApi\.list\(\{ status: 'APPROVED', limit: 100 \}\)/);
});

test('server-backed feed dimensions reset the cursor and are sent with each page', () => {
  assert.match(home, /category: activeCat === 'all' \? '' : activeCat/);
  assert.match(home, /q: searchQuery\.trim\(\)/);
  assert.match(home, /minDiscount: minDiscount \|\| ''/);
  assert.match(home, /minPrice: selectedPriceTier\.min \?\? ''/);
  assert.match(home, /maxPrice: selectedPriceTier\.max \?\? ''/);
  assert.match(home, /setNextCursor\(null\)/);
});

test('intersection paging reveals loaded deals before requesting the next remote cursor', () => {
  assert.match(home, /const hasLocalMore = visibleCount < exploreDeals\.length/);
  assert.match(home, /if \(hasLocalMore\) setVisibleCount/);
  assert.match(home, /else loadRemotePage\(\)/);
  assert.match(home, /cursor: nextCursor/);
  assert.match(home, /mergeDeals\(current, page\?\.items \|\| \[\]\)/);
});

test('search paging is cancellable and modestly debounced', () => {
  assert.match(home, /const controller = new AbortController\(\)/);
  assert.match(home, /searchQuery\.trim\(\) \? 250 : 0/);
  assert.match(home, /controller\.abort\(\)/);
});
