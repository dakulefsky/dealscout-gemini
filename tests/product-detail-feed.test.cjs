const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');

test('product detail continues browsing with a category-first recommendation feed', () => {
  assert.match(source, /More deals you might like/);
  assert.match(source, /dealsApi\.page\(\{ category: data\.category, limit: 16, sort: '-discount_percent' \}\)/);
  assert.match(source, /primaryRows\.length < 9/);
  assert.match(source, /dealsApi\.page\(\{ limit: 24, sort: '-discount_percent' \}\)/);
  assert.match(source, /personalizedRank\(eligible, interests\)/);
  assert.match(source, /itemId === currentId/);
  assert.match(source, /<DealCard key=\{dealIdentity\(item\)\} deal=\{item\} \/>/);
});

test('product recommendations dedupe fallback inventory and stay balanced', () => {
  assert.match(source, /const seen = new Set\(\)/);
  assert.match(source, /seen\.has\(itemId\)/);
  assert.match(source, /seen\.add\(itemId\)/);
  assert.match(source, /item\?\.isExpired/);
  assert.match(source, /item\?\.status === 'EXPIRED'/);
  assert.match(source, /const evenLength = ranked\.length - \(ranked\.length % 2\)/);
  assert.match(source, /return evenLength >= 2 \? ranked\.slice\(0, evenLength\) : \[\]/);
});

test('product detail makes verified savings and price status first class', () => {
  assert.match(source, /aria-label="Deal facts"/);
  assert.match(source, /You save/);
  assert.match(source, /Price status/);
  assert.match(source, /View deal on Amazon/);
});

test('product share uses native sharing when available and only claims clipboard success after awaiting it', () => {
  assert.match(source, /async function handleShare\(\)/);
  assert.match(source, /typeof navigator\.share === 'function'/);
  assert.match(source, /await navigator\.share\(\{ title: deal\?\.title \|\| 'DealScout deal', url \}\)/);
  assert.match(source, /if \(error\?\.name === 'AbortError'\) return/);
  assert.match(source, /await navigator\.clipboard\.writeText\(url\)/);
  assert.match(source, /toast\(\{ title: 'Link copied' \}\)/);
  assert.match(source, /Could not share link/);
  assert.doesNotMatch(source, /navigator\.clipboard\.writeText\(window\.location\.href\);\s*setCopiedLink\(true\)/);
});
