const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const helper = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'feedChapters.js'), 'utf8');

test('feed chapters include personalized, price, budget and discovery lanes', () => {
  assert.match(helper, /More in this department/);
  assert.match(helper, /Biggest price drops/);
  assert.match(helper, /Lower-priced finds/);
  assert.match(helper, /More live deals/);
});

test('discovery excludes the shopper strongest interest categories', () => {
  assert.match(helper, /strongestInterestCategories/);
  assert.match(helper, /familiar = new Set/);
  assert.match(helper, /!familiar\.has/);
});
