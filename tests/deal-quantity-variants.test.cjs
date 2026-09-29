const test = require('node:test');
const assert = require('node:assert/strict');
const { quantityFamilyKey } = require('../server/services/dealVariantPolicy');
const feed = require('../server/repositories/dealFeedRepository');
const db = require('../server/db');

const title = (count) => `Blink Outdoor 2K+ (newest model) — Wireless smart security camera. Sync Module Core included — ${count} camera system (Black)`;
const family = (value) => quantityFamilyKey({ title: value, category: 'Electronics' });

test('quantity grouping keeps model, colour, and accessory distinctions', () => {
  assert.equal(family(title(3)), family(title(5)));
  assert.notEqual(family(title(3)), family(title(5).replace('2K+', '4')));
  assert.notEqual(family(title(3)), family(title(5).replace('(Black)', '(White)')));
  assert.notEqual(family(title(3)), family(title(5).replace('Core included', 'XR included')));
  assert.equal(family('Brand Widget pack of 3'), family('Brand Widget pack of 6'));
  assert.equal(family('Brand Widget 3-pack'), family('Brand Widget 6-pack'));
  assert.equal(family('Monitor 32 inch 4K'), null);
});

test('browsing groups quantity offers before pagination; search retains them', async () => {
  const original = db.tables.deals;
  const now = Math.floor(Date.now() / 1000);
  const row = (id, value, quality, price = 70) => ({
    id, asin: id, title: value, category: 'Electronics',
    original_price: 100, sale_price: price, quality_score: quality,
    created_at: now, price_check_at: now, source_verified: 1,
    status: 'APPROVED', is_expired: 0,
  });
  db.tables.deals = [
    row('B000000001', title(3), 100),
    row('B000000002', title(5), 90, 60),
    row('B000000003', title(5).replace('2K+', '4'), 80),
    row('B000000004', 'Unrelated headphones', 70),
  ];
  try {
    const first = await feed.page({ sort: 'best', limit: 1 });
    const second = await feed.page({ sort: 'best', limit: 1, cursor: first.nextCursor });
    const third = await feed.page({ sort: 'best', limit: 1, cursor: second.nextCursor });
    assert.equal(third.nextCursor, null);
    const shown = [...first.items, ...second.items, ...third.items];
    assert.equal(shown.filter((deal) => deal.title.includes('2K+')).length, 1);
    assert.ok(shown.some((deal) => deal.title.includes('Outdoor 4')));
    const search = await feed.page({ q: 'Blink', sort: 'best' });
    assert.equal(search.items.length, 3);
    const price = await feed.page({ sort: 'price_asc' });
    assert.equal(price.items.find((deal) => deal.title.includes('2K+')).asin, 'B000000002');
    const filtered = await feed.page({ maxPrice: 65 });
    assert.equal(filtered.items[0].asin, 'B000000002');
  } finally { db.tables.deals = original; }
});
