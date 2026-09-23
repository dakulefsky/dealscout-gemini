const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('homepage department entry is complete and avoids awkward capped-deal copy', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /Shop by department/);
  assert.match(home, /Browse all current deals/);
  assert.match(home, /Standout deals/);
  assert.doesNotMatch(home, /Three strong ones/);
  assert.doesNotMatch(home, /You’ve seen today’s best deals|Come back later for newly verified finds/);
});

test('admin exposes deal management directly instead of hiding delete inside editorial review', () => {
  const admin = read('src/pages/AdminHome.jsx');
  const app = read('src/App.jsx');
  const layout = read('src/components/Layout.jsx');
  const manager = read('src/pages/EditorialReview.jsx');
  assert.match(admin, /Find or remove a deal/);
  assert.match(admin, /to="\/admin\/deals"/);
  assert.match(app, /path="\/admin\/deals"/);
  assert.match(layout, /Manage deals/);
  assert.match(manager, /Manage Deals/);
  assert.match(manager, /Remove Permanently/);
});
