const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('homepage hero is selected from the live catalog, not only unseen drop deals', () => {
  assert.match(home, /selectHeroDeal\(visibleDeals\)/);
  assert.doesNotMatch(home, /selectHeroDeal\(dropDeals\)/);
  assert.match(home, /if \(heroDeal\) ids\.add\(heroDeal\.id \|\| heroDeal\.asin\)/);
});

test('homepage retains an intro when no deal earns the oversized hero slot', () => {
  assert.match(home, /showCuratedHome && !heroDeal/);
  assert.match(home, /no oversized feature unless the discount genuinely earns it/i);
});
