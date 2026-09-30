const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');


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
