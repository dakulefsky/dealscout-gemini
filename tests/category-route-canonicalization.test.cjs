const test = require('node:test');
const assert = require('node:assert/strict');

test('canonical category paths match DealScout category slugs', async () => {
  const { categoryPathFromName } = await import('../src/lib/categoryRoutes.js');
  assert.equal(categoryPathFromName('Home & Kitchen'), '/category/home-kitchen');
  assert.equal(categoryPathFromName('Sports & Outdoors'), '/category/sports-outdoors');
  assert.equal(categoryPathFromName('Tools & Home Improvement'), '/category/tools-home-improvement');
  assert.equal(categoryPathFromName('Electronics'), '/category/electronics');
});
