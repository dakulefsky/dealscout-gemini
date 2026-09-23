const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { categorySeoContent } = require('../src/lib/categorySeoContent.js');

test('category notes stay concrete and avoid generic SEO-template language', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'categorySeoContent.js'), 'utf8');
  assert.doesNotMatch(source, /permanent category|stable destination|live offers change|lasting destination|search discovery/i);
  assert.match(source, /Model numbers matter/);
  assert.match(source, /Fitment comes first/);
  assert.match(source, /Variant pricing is the trap here/);
});

test('every canonical shopper department has distinct guidance', () => {
  const slugs = ['electronics','home-kitchen','sports-outdoors','health-beauty','toys-games','baby','pet-supplies','automotive','tools-home-improvement','office-school','clothing-accessories','grocery','other'];
  const guidance = slugs.map((slug) => categorySeoContent(slug).guidance);
  assert.equal(new Set(guidance).size, slugs.length);
});
