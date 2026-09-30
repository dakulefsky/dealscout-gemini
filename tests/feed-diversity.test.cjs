const test = require('node:test');
const assert = require('node:assert/strict');

test('broad best-deal feeds interleave departments while preserving rank within each one', async () => {
  const { interleaveCategories } = await import('../src/lib/feedDiversity.js');
  const input = [
    { id: 'a1', category: 'Electronics' },
    { id: 'a2', category: 'Electronics' },
    { id: 'b1', category: 'Home' },
    { id: 'c1', category: 'Clothing' },
    { id: 'b2', category: 'Home' },
  ];

  assert.deepEqual(interleaveCategories(input).map((item) => item.id), ['a1', 'b1', 'c1', 'a2', 'b2']);
});
