const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const category = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'CategoryPage.jsx'), 'utf8');

test('category page uses the shared cursor feed instead of a fixed list query', () => {
  assert.match(category, /dealsApi\.page\(\{ category: found\.name, sort: serverSort\(sort\), limit: PAGE_SIZE \}/);
  assert.doesNotMatch(category, /dealsApi\.list\(/);
  assert.doesNotMatch(category, /limit: 50/);
});

test('category sort changes restart the server cursor query', () => {
  assert.match(category, /\[slug, sort\]/);
  assert.match(category, /setDeals\(\[\]\)/);
  assert.match(category, /setNextCursor\(null\)/);
  assert.match(category, /discount_desc/);
  assert.match(category, /price_asc/);
  assert.match(category, /price_desc/);
});

test('category page loads the next cursor page near the viewport and deduplicates results', () => {
  assert.match(category, /new IntersectionObserver/);
  assert.match(category, /rootMargin: '700px 0px'/);
  assert.match(category, /cursor: nextCursor/);
  assert.match(category, /mergeDeals\(current, page\.items \|\| \[\]\)/);
});

test('category view controls have accessible names', () => {
  assert.match(category, /aria-label="Grid view"/);
  assert.match(category, /aria-label="List view"/);
});
