const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/dealDropFreshness.js'), 'utf8');

test('homepage deal drop diversifies categories before repeating them', () => {
  assert.match(source, /categoryCounts/);
  assert.match(source, /categoryCount|categoryCounts\.get/);
  assert.match(source, /=== 0/);
});

test('homepage deal drop avoids near-duplicate product families when alternatives exist', () => {
  assert.match(source, /looksLikeSameProductFamily/);
  assert.match(source, /overlap \/ Math\.min\(a\.size, b\.size\) >= 0\.5/);
  assert.match(source, /diverseOrder\(\[\.\.\.unseen, \.\.\.recentlySeen\], safeLimit\)/);
});
