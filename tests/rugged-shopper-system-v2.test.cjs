const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('shopper system favors hard rules, compressed hierarchy, and terse copy', () => {
  const css = read('src/index.css');
  const layout = read('src/components/Layout.jsx');
  const home = read('src/pages/Home.jsx');
  const card = read('src/components/DealCard.jsx');
  assert.match(css, /--radius: 0\.125rem/);
  assert.match(layout, /border-b-2 border-emerald-950/);
  assert.doesNotMatch(layout, /backdrop-blur-md/);
  assert.match(home, />Departments<\/h1>/);
  assert.match(home, />Standouts<\/h2>/);
  assert.match(home, /15%\+ off · recently checked/);
  assert.doesNotMatch(home, /Three strong ones|Today’s edit|Worth a closer look/);
  assert.match(card, /border-t-\[3px\]/);
});
