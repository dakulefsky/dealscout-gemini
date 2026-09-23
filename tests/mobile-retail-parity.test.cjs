const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'app', 'index.jsx'), 'utf8');
const detail = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'app', 'deal', '[id].jsx'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'src', 'components', 'DealCard.jsx'), 'utf8');

test('mobile home starts with compact departments instead of a giant deal-site hero', () => {
  assert.match(home, /DEPARTMENTS/);
  assert.match(home, /LIVE INVENTORY/);
  assert.doesNotMatch(home, /The deals worth seeing/);
  assert.doesNotMatch(home, /Fresh finds, checked prices, less clutter/);
});

test('mobile detail and cards use the same terse retail language as web', () => {
  assert.match(detail, /MORE DEALS/);
  assert.match(detail, /Keep browsing/);
  assert.doesNotMatch(detail, /More deals you might like|your interests ranked first/);
  assert.match(card, /borderTopWidth: 3/);
  assert.match(card, /CHECKED NOW/);
  assert.match(detail, /retryNonce/);
  assert.match(detail, /Retry loading deal/);
});
