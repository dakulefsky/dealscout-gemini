const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');

test('admin routes do not render shopper-only chrome', () => {
  assert.match(layout, /const isAdminArea = location\.pathname\.startsWith\('\/admin'\)/);
  assert.match(layout, /!isAdminArea && <AffiliateBanner \/>/);
  assert.match(layout, /!isAdminArea && <footer/);
  assert.match(layout, /isAdminArea \? 'Operations' : 'Verified Amazon deals'/);
  assert.match(layout, /if \(isAdminArea\) return;/);
});
