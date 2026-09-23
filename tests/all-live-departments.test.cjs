const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
const mobile = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'app', 'index.jsx'), 'utf8');

test('category-first home does not arbitrarily hide active departments', () => {
  assert.match(web, /categories\.map\(\(category, index\)/);
  assert.doesNotMatch(web, /categories\.slice\(/);
  assert.match(mobile, /categories\.map\(\(category, index\)/);
  assert.doesNotMatch(mobile, /categories\.slice\(0, 8\)/);
});
