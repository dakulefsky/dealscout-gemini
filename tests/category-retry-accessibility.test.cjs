const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'CategoryPage.jsx'), 'utf8');

test('category first-page errors can retry without reloading', () => {
  assert.match(source, /retryInitial/);
  assert.match(source, /setRetryInitial\(\(value\) => value \+ 1\)/);
  assert.match(source, /\[slug, sort, retryInitial\]/);
});

test('category view-mode controls expose pressed state', () => {
  assert.match(source, /aria-pressed=\{viewMode === 'grid'\}/);
  assert.match(source, /aria-pressed=\{viewMode === 'list'\}/);
});
