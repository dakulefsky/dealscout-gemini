const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const auth = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'AuthContext.jsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');

test('public shopper routes do not make private auth checks', () => {
  assert.match(auth, /window\.location\.pathname\.startsWith\('\/admin'\)/);
  assert.match(auth, /if \(!onAdminRoute\)/);
});

test('admin logout stays in the admin surface', () => {
  assert.match(auth, /window\.location\.href = '\/admin\/access'/);
});

test('admin shopper link goes to the public DealScout domain', () => {
  assert.match(layout, /href="https:\/\/dealscouted\.com"/);
});
