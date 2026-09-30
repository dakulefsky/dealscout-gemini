const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = fs.readFileSync(path.join(__dirname, '..', 'src/pages/Home.jsx'), 'utf8');
test('home presents departments before products and an accessible browse toolbar', () => {
  assert.match(home, /Shop by department/);
  assert.ok(home.indexOf('aria-label="Shop by department"') < home.indexOf('aria-labelledby="best-deals-heading"'));
  assert.match(home, /encodeURIComponent\(category.name\)/);
  assert.match(home, /categories.map\(\(category\)/);
  assert.match(home, /aria-labelledby="best-deals-heading"/);
  assert.match(home, /aria-labelledby="browse-deals-heading"/);
  assert.doesNotMatch(home, /Standouts|Selected deals|chapterBlock|Departments<\/h1>/);
  assert.match(home, /aria-label="Department"/);
  assert.match(home, /imagePriority=\{prioritizeImages && index < 2\}/);
});
