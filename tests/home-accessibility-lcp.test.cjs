const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('homepage prioritizes the above-the-fold hero image', () => {
  assert.match(source, /loading="eager" fetchPriority="high"/);
});

test('homepage filter controls expose accessible names and state', () => {
  assert.match(source, /aria-label="Search deals"/);
  assert.match(source, /aria-label="Sort deals"/);
  assert.match(source, /aria-label="Toggle deal filters" aria-expanded=\{showFilters\}/);
  assert.match(source, /aria-label="Minimum discount"/);
  assert.match(source, /aria-label="Price range"/);
});
