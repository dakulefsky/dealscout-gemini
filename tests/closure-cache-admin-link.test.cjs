const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const closure = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'jewishClosureService.js'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'AdminHome.jsx'), 'utf8');

test('closure checks cache the saved location instead of hitting settings storage on every asset/API request', () => {
  assert.match(closure, /LOCATION_TTL_MS/);
  assert.match(closure, /selectedLocationCache/);
  assert.match(closure, /selectedLocationCache = null/);
});

test('admin dashboard opens the actual public shopper domain', () => {
  assert.match(admin, /href="https:\/\/dealscouted\.com"/);
  assert.doesNotMatch(admin, /to="\/"[^>]*>Open shopper site/);
});
