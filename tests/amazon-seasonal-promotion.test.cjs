const test = require('node:test');
const assert = require('node:assert/strict');
const { blackFridayDate, cyberMondayDate, dateInNewYork, activePromotionFor } = require('../server/services/amazonSeasonalPromotion');

test('annual Black Friday and Cyber Monday dates are derived from the US calendar', () => {
  assert.equal(blackFridayDate(2024), '2024-11-29');
  assert.equal(cyberMondayDate(2024), '2024-12-02');
  assert.equal(blackFridayDate(2026), '2026-11-27');
  assert.equal(cyberMondayDate(2026), '2026-11-30');
});

test('annual banner follows New York local dates and ends after Cyber Monday', () => {
  assert.equal(dateInNewYork(new Date('2026-11-27T04:59:00.000Z')), '2026-11-26');
  assert.equal(dateInNewYork(new Date('2026-11-27T05:00:00.000Z')), '2026-11-27');
  assert.equal(activePromotionFor('2026-11-26'), null);
  assert.equal(activePromotionFor('2026-11-27')?.id, 'black-friday-cyber-monday');
  assert.equal(activePromotionFor('2026-11-30')?.id, 'black-friday-cyber-monday');
  assert.equal(activePromotionFor('2026-12-01'), null);
});

test('Prime Day only appears inside the saved, operator-confirmed date range', () => {
  assert.equal(activePromotionFor('2026-07-13', '2026-07-14', '2026-07-15'), null);
  assert.equal(activePromotionFor('2026-07-14', '2026-07-14', '2026-07-15')?.id, 'prime-day');
  assert.equal(activePromotionFor('2026-07-15', '2026-07-14', '2026-07-15')?.id, 'prime-day');
  assert.equal(activePromotionFor('2026-07-16', '2026-07-14', '2026-07-15'), null);
});
