const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../server/db');
const feed = require('../server/repositories/dealFeedRepository');
const categories = require('../server/repositories/categoryRepository');
const provider = require('../server/services/providerRouter');

const now = Math.floor(Date.now() / 1000);
const row = (index, category, quality = 100) => ({
  id: `B${String(index).padStart(9, '0')}`, asin: `B${String(index).padStart(9, '0')}`,
  title: `Product ${index}`, category, original_price: 100, sale_price: 60,
  quality_score: quality, source_verified: 1, is_expired: 0, status: 'APPROVED',
  price_check_at: now, created_at: now - index,
});

test('manual-provider products use canonical categories before saving', () => {
  provider.cacheRainforestBulkResults([
    { asin: 'B000000001', title: "Women's Summer Blouses", category: 'Women', originalPrice: 100, salePrice: 60 },
    { asin: 'B000000002', title: "Women's Leggings", category: 'Fashion', originalPrice: 100, salePrice: 60 },
  ]);
  assert.equal(provider.cachedRainforestProduct('B000000001').category, 'Clothing & Accessories');
  assert.equal(provider.cachedRainforestProduct('B000000002').category, 'Clothing & Accessories');
});

test('older marketplace imports become countable without changing approval or prices', async () => {
  const previous = db.tables.deals; const save = db.saveDb;
  db.saveDb = () => {};
  db.tables.deals = [
    { ...row(1, 'Women'), title: "Women's Summer Blouses" },
    { ...row(2, 'Other'), title: "Women's Leggings", status: 'PENDING_REVIEW' },
    { ...row(3, 'Electronics'), title: 'Top Rated Laptop' },
  ];
  try {
    assert.equal(await categories.repairImportedCategories(), 2);
    assert.equal(await categories.repairImportedCategories(), 0);
    assert.equal(db.tables.deals[1].status, 'PENDING_REVIEW');
    assert.equal(db.tables.deals[0].sale_price, 60);
    const active = await categories.list({ activeOnly: true });
    assert.equal(active.find((c) => c.slug === 'clothing-accessories').liveCount, 1);
    assert.equal(db.tables.deals[2].category, 'Electronics');
  } finally { db.tables.deals = previous; db.saveDb = save; }
});

test('top deals includes smaller departments and pages every eligible product once', async () => {
  const previous = db.tables.deals;
  db.tables.deals = [
    ...Array.from({ length: 30 }, (_, i) => row(i, 'Electronics', 100 - i)),
    row(40, 'Clothing & Accessories', 60), row(41, 'Home & Kitchen', 65),
    row(42, 'Clothing & Accessories', 50), row(43, 'Home & Kitchen', 55),
  ];
  try {
    const first = await feed.page({ sort: 'best', limit: 3 });
    assert.equal(new Set(first.items.map((item) => item.category)).size, 3);
    let cursor = first.nextCursor; const ids = first.items.map((item) => item.id);
    while (cursor) {
      const page = await feed.page({ sort: 'best', limit: 3, cursor });
      ids.push(...page.items.map((item) => item.id)); cursor = page.nextCursor;
      assert.ok(ids.length <= 34);
    }
    assert.equal(ids.length, 34); assert.equal(new Set(ids).size, 34);
    const department = await feed.page({ sort: 'best', category: 'Electronics', limit: 3 });
    assert.deepEqual(department.items.map((item) => item.id), db.tables.deals.slice(0, 3).map((item) => item.id));
    const search = await feed.page({ sort: 'best', q: 'Product', limit: 3 });
    assert.ok(search.items.every((item) => item.category === 'Electronics'));
    const discounts = await feed.page({ sort: 'discount_desc', limit: 3 });
    assert.ok(discounts.items.every((item) => item.category === 'Electronics'));
  } finally { db.tables.deals = previous; }
});
