const test = require('node:test');
const assert = require('node:assert/strict');

test('product title separates the identifying name from marketing details without rewriting it', async () => {
  const { splitProductTitle } = await import('../src/lib/productTitle.js');
  const result = splitProductTitle('Philips Sonicare 5950 Electric Toothbrush, 2 Brush Heads, Black | Pressure Sensor');
  assert.equal(result.name, 'Philips Sonicare 5950 Electric Toothbrush');
  assert.equal(result.details, '2 Brush Heads, Black | Pressure Sensor');
  const shortName = splitProductTitle('Ring, Indoor Cam newest model — White');
  assert.equal(shortName.name, 'Ring, Indoor Cam newest model');
  assert.equal(shortName.details, 'White');
  assert.deepEqual(splitProductTitle('A short product name'), { name: 'A short product name', details: '' });
});
