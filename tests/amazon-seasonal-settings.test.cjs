const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePrimeDayDates } = require('../server/middleware/amazonSeasonalPromotionEndpoint');

test('Prime Day schedule requires both dates and a range no longer than seven days', () => {
  assert.deepEqual(validatePrimeDayDates('', ''), { valid: true });
  assert.equal(validatePrimeDayDates('2026-07-14', '').valid, false);
  assert.equal(validatePrimeDayDates('', '2026-07-15').valid, false);
  assert.equal(validatePrimeDayDates('2026-07-14', '2026-07-15').valid, true);
  assert.equal(validatePrimeDayDates('2026-07-14', '2026-07-20').valid, true);
  assert.equal(validatePrimeDayDates('2026-07-14', '2026-07-21').valid, false);
  assert.equal(validatePrimeDayDates('2026-07-15', '2026-07-14').valid, false);
});

test('Prime Day schedule rejects impossible and malformed dates', () => {
  assert.equal(validatePrimeDayDates('2026-02-30', '2026-03-01').valid, false);
  assert.equal(validatePrimeDayDates('July 14, 2026', '2026-07-15').valid, false);
});
