const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');

test('header search does not hit the API for one-character probes', () => {
  assert.match(source, /const MIN_SEARCH_CHARS = 2/);
  assert.match(source, /query\.length < MIN_SEARCH_CHARS/);
});

test('header search follows browser and URL query navigation', () => {
  assert.match(source, /new URLSearchParams\(location\.search\)\.get\('q'\)/);
  assert.match(source, /setSearchQuery\(urlQuery\)/);
});

test('header search exposes combobox and result-list semantics', () => {
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-label="Search DealScout"/);
  assert.match(source, /aria-controls="dealscout-search-results"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
});
