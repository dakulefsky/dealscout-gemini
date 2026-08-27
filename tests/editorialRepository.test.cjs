const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEditorialInput } = require('../server/repositories/editorialRepository');

test('human editorial input is normalized and auditable', () => {
  const row = normalizeEditorialInput({
    asin: 'b0gggqdy9h',
    editorialNote: '  Strong current discount on a model we chose to feature.  ',
    isHumanPick: true,
    reviewedBy: 'admin@example.com',
    reviewedAt: 12345,
  });
  assert.equal(row.asin, 'B0GGGQDY9H');
  assert.equal(row.editorial_note, 'Strong current discount on a model we chose to feature.');
  assert.equal(row.is_human_pick, true);
  assert.equal(row.reviewed_by, 'admin@example.com');
  assert.equal(row.reviewed_at, 12345);
});

test('editorial input rejects invalid asin and oversized notes', () => {
  assert.throws(() => normalizeEditorialInput({ asin: 'bad', editorialNote: 'x' }), /ASIN/);
  assert.throws(() => normalizeEditorialInput({ asin: 'B0GGGQDY9H', editorialNote: 'x'.repeat(601) }), /600/);
});
