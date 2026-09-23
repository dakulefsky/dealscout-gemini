const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cache = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'publicCatalogCache.js'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
const bookmarks = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'BookmarksContext.jsx'), 'utf8');

test('shopper shell and homepage share one short-lived active-category request', () => {
  assert.match(cache, /const TTL_MS = 60_000/);
  assert.match(cache, /if \(!force && inFlight\) return inFlight/);
  assert.match(layout, /getActiveCategories\(\)/);
  assert.match(home, /getActiveCategories\(\)/);
  assert.doesNotMatch(layout, /categoriesApi\.list\(\)/);
  assert.doesNotMatch(home, /categoriesApi\.list\(\)/);
});

test('private admin routes do not make the shopper bookmark request on mount', () => {
  assert.match(bookmarks, /window\.location\.pathname\.startsWith\('\/admin'\)/);
  assert.match(bookmarks, /if \(window\.location\.pathname\.startsWith\('\/admin'\)\) return/);
});
