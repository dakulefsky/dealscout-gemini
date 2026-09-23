const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const feed = require('../server/repositories/dealFeedRepository');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function deal({ quality = 70, original = 100, sale = 70, created = 100, id = 'a' } = {}) {
  return { quality_score: quality, original_price: original, sale_price: sale, created_at: created, id };
}

test('feed supports a real server-side best sort instead of treating best as newest', () => {
  assert.equal(feed.normalizeSort('best'), 'best');
  assert.match(feed.orderBy('best'), /quality_score/);
  assert.match(feed.orderBy('best'), /original_price - sale_price/);
  assert.notEqual(feed.orderBy('best'), feed.orderBy('-created_date'));
  assert.ok(feed.bestScore(deal({ quality: 95, original: 200, sale: 100 })) > feed.bestScore(deal({ quality: 40, original: 100, sale: 80 })));
});

test('web and mobile send best to the server for Top deals', () => {
  for (const file of ['src/pages/Home.jsx', 'src/pages/CategoryPage.jsx', 'apps/mobile/app/index.jsx']) {
    assert.match(read(file), /if \(sort === 'best'\) return 'best'/, file);
  }
});

test('discount filters do not duplicate the site-wide 15 percent floor', () => {
  const home = read('src/pages/Home.jsx');
  const mobile = read('apps/mobile/app/index.jsx');
  assert.match(home, /15%\+ \(all deals\)/);
  assert.match(mobile, /15%\+ \(all deals\)/);
  assert.doesNotMatch(home, /\{ value: 15, label: '15%\+ off' \}/);
  assert.doesNotMatch(mobile, /\{ value: 15, label: '15%\+' \}/);
});

test('mobile feed has no artificial caught-up message or vague deal-finding copy', () => {
  const mobile = read('apps/mobile/app/index.jsx');
  assert.doesNotMatch(mobile, /You’ve seen today’s best deals|Finding good deals|WORTH IT TODAY|Strong discounts, checked/);
  assert.match(mobile, /30%\+ OFF/);
  assert.match(mobile, /Standouts/);
});
