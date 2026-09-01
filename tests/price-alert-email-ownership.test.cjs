const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'bookmarks.js'), 'utf8');

test('guest price alerts cannot activate without verified account email ownership', () => {
  assert.match(source, /verified: user\.verified === 1 \|\| user\.verified === true/);
  assert.match(source, /authenticated: false, verified: false/);
  assert.match(source, /!identity\.authenticated \|\| !identity\.verified \|\| !identity\.email/);
  assert.match(source, /A verified account email is required for price alerts/);
});

test('price alert delivery address comes from the verified account, not request input', () => {
  assert.match(source, /const email = String\(identity\.email\)/);
  assert.doesNotMatch(source, /req\.body\?\.email/);
});
