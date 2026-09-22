const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
const detail = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');
const bookmarks = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'BookmarksContext.jsx'), 'utf8');

test('homepage resets local search/category state when URL params disappear', () => {
  assert.match(home, /setSearchQuery\(searchParams\.get\('q'\) \|\| ''\)/);
  assert.match(home, /setActiveCat\(searchParams\.get\('category'\) \|\| 'all'\)/);
});

test('product recommendations use shared deal ranking instead of raw discount score', () => {
  assert.match(detail, /dealRankScore\(item\)/);
  assert.doesNotMatch(detail, /const discount = Number\(item\?\.discountPercent/);
});

test('bookmark context normalizes ids and reports failed optimistic updates', () => {
  assert.match(bookmarks, /map\(String\)/);
  assert.match(bookmarks, /includes\(String\(dealId \|\| ''\)\)/);
  assert.match(bookmarks, /Could not update saved deals/);
});
