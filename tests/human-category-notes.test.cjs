const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'categorySeoContent.js'), 'utf8');

test('category notes stay concrete and avoid generic SEO-template language', () => {
  assert.doesNotMatch(source, /permanent category|stable destination|live offers change|lasting destination|search discovery/i);
  assert.match(source, /Model numbers matter/);
  assert.match(source, /Fitment comes first/);
  assert.match(source, /Variant pricing is the trap here/);
});

test('canonical departments each carry explicit guidance copy', () => {
  const slugs = ['electronics','home-kitchen','sports-outdoors','health-beauty','toys-games','baby','pet-supplies','automotive','tools-home-improvement','office-school','clothing-accessories','grocery','other'];
  for (const slug of slugs) {
    assert.ok(source.includes(slug), `missing ${slug}`);
  }
  assert.ok((source.match(/guidance:/g) || []).length >= slugs.length);
});
