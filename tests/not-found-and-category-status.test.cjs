const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('unknown shopper routes render a not-found page instead of silently redirecting home', () => {
  assert.match(app, /const NotFound = lazy/);
  assert.match(app, /<Route path="\*" element=\{<NotFound \/>\} \/>/);
  assert.doesNotMatch(app, /<Route path="\*" element=\{<Navigate to="\/" replace \/>\}/);
});

test('canonical categories remain valid even when current inventory is empty', () => {
  assert.match(server, /categoryRepository\.list\(\{ slug: decodeURIComponent\(categoryMatch\[1\]\), activeOnly: false \}\)/);
});
