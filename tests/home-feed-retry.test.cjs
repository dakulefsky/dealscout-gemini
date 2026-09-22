const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('home feed retry does not hard reload the shopper app', () => {
  assert.match(home, /retryNonce/);
  assert.match(home, /setRetryNonce\(\(value\) => value \+ 1\)/);
  assert.doesNotMatch(home, /window\.location\.reload\(\)/);
});
