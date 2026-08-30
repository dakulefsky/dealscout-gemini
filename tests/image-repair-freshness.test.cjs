const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('image repair never marks stored prices as freshly checked', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'imageRepairService.js'), 'utf8');
  assert.equal(source.includes("await deals.update(deal.id, { image_url: live.imageUrl });"), true);
  assert.equal(source.includes("image_url: live.imageUrl, price_check_at"), false);
});
