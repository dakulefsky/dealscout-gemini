const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = fs.readFileSync(path.join(__dirname, '..', 'src/pages/Home.jsx'), 'utf8');
test('home presents a concise heading followed by products and an accessible browse toolbar', () => {
  assert.match(home, /Today’s deals/);
  assert.match(home, /aria-labelledby="best-deals-heading"/);
  assert.match(home, /aria-labelledby="browse-deals-heading"/);
  assert.doesNotMatch(home, /Standouts|Selected deals|chapterBlock|Departments<\/h1>/);
  assert.match(home, /aria-label="Department"/);
  assert.match(home, /imagePriority=\{prioritizeImages && index < 2\}/);
});
