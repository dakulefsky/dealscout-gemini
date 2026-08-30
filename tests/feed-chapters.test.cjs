const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const helper = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'feedChapters.js'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('feed chapters include personalized, price, budget and discovery lanes', () => {
  assert.match(helper, /Because you’re checking out/);
  assert.match(helper, /Biggest price drops/);
  assert.match(helper, /Good finds under \$25/);
  assert.match(helper, /Something different/);
});

test('discovery excludes the shopper strongest interest categories', () => {
  assert.match(helper, /strongestInterestCategories/);
  assert.match(helper, /familiar = new Set/);
  assert.match(helper, /!familiar\.has/);
});

test('chapter products are deduplicated from Deal Drop and Explore', () => {
  assert.match(helper, /initiallyUsedIds/);
  assert.match(helper, /used\.has/);
  assert.match(home, /chapterDealIds/);
  assert.match(home, /!dropIds\.has\(id\) && !chapterIds\.has\(id\)/);
});

test('home interleaves a chapter every eight progressively revealed deals', () => {
  assert.match(home, /CHAPTER_INTERVAL = 8/);
  assert.match(home, /start \+= CHAPTER_INTERVAL/);
  assert.match(home, /chapters\[Math\.floor\(start \/ CHAPTER_INTERVAL\)\]/);
});
