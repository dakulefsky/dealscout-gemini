const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../server/db');
const categories = require('../server/repositories/categoryRepository');
const deals = require('../server/repositories/dealRepository');
const { classifyCategory } = require('../server/services/categoryClassifier');

test('new provider departments are readable and generic labels do not create departments', () => {
  assert.equal(classifyCategory({ rawCategory: 'books', title: 'Hardcover Novel' }), 'Books');
  assert.equal(classifyCategory({ rawCategory: 'Musical Instruments', title: 'Acoustic Guitar' }), 'Musical Instruments');
  for (const rawCategory of ['Amazon', 'aps', 'Products', 'Women', '123456', 'https://amazon.com/foo', '<script>bad</script>', 'A'.repeat(100)]) {
    assert.equal(classifyCategory({ rawCategory, title: 'Special Item' }), 'Other', rawCategory);
  }
  assert.equal(classifyCategory({ rawCategory: 'Women', title: 'Summer Blouse' }), 'Clothing & Accessories');
});

test('saving real inventory creates departments, deduplicates names, and activates them only for public deals', async () => {
  const previousDeals = db.tables.deals; const previousCategories = db.tables.categories; const save = db.saveDb;
  db.tables.deals = []; db.tables.categories = []; db.saveDb = () => {};
  const now = Math.floor(Date.now() / 1000);
  const product = { id: 'B000000001', asin: 'B000000001', title: 'Hardcover Novel', category: 'Books', original_price: 100, sale_price: 60, source_verified: 1, is_expired: 0, price_check_at: now, status: 'PENDING_REVIEW' };
  try {
    await deals.upsert(product);
    assert.ok((await categories.list()).some((c) => c.slug === 'books'));
    assert.ok(!(await categories.list({ activeOnly: true })).some((c) => c.slug === 'books'));
    await deals.update(product.id, { status: 'APPROVED', category: 'books' });
    const active = await categories.list({ activeOnly: true });
    assert.equal(active.find((c) => c.slug === 'books').liveCount, 1);
    assert.equal((await categories.list()).filter((c) => c.slug === 'books').length, 1);
    assert.equal((await deals.findByIdOrAsin(product.id)).category, 'Books');
    await categories.create({ id: 'manual', name: 'Custom Department', slug: 'my-department' });
    assert.equal(await categories.ensureForDeal('custom department'), 'Custom Department');
    assert.ok((await categories.list()).some((c) => c.slug === 'my-department'));
  } finally { db.tables.deals = previousDeals; db.tables.categories = previousCategories; db.saveDb = save; }
});

test('recovery registers existing meaningful departments instead of leaving them invisible', async () => {
  const previousDeals = db.tables.deals; const previousCategories = db.tables.categories; const save = db.saveDb;
  const now = Math.floor(Date.now() / 1000);
  db.tables.categories = []; db.saveDb = () => {};
  db.tables.deals = [{ id: 'B000000001', asin: 'B000000001', title: 'Hardcover Novel', category: 'Books', original_price: 100, sale_price: 60, source_verified: 1, status: 'APPROVED', price_check_at: now, is_expired: 0 }];
  try {
    await categories.repairImportedCategories();
    assert.equal((await categories.list({ activeOnly: true })).find((c) => c.slug === 'books').liveCount, 1);
    await categories.repairImportedCategories();
    assert.equal(db.tables.categories.filter((c) => c.slug === 'books').length, 1);
  } finally { db.tables.deals = previousDeals; db.tables.categories = previousCategories; db.saveDb = save; }
});
