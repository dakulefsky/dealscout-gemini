const test = require('node:test');
const assert = require('node:assert/strict');
const { thanksgivingDate, blackFridayDate, cyberMondayDate, dateInNewYork, activePromotionFor } = require('../server/services/amazonSeasonalPromotion');

test('annual Black Friday and Cyber Monday dates are derived from the US calendar', () => {
  assert.equal(thanksgivingDate(2024), '2024-11-28');
  assert.equal(blackFridayDate(2024), '2024-11-29');
  assert.equal(cyberMondayDate(2024), '2024-12-02');
  assert.equal(thanksgivingDate(2026), '2026-11-26');
  assert.equal(blackFridayDate(2026), '2026-11-27');
  assert.equal(cyberMondayDate(2026), '2026-11-30');
});

test('annual banner follows New York local dates and ends after Cyber Monday', () => {
  assert.equal(dateInNewYork(new Date('2026-11-27T04:59:00.000Z')), '2026-11-26');
  assert.equal(dateInNewYork(new Date('2026-11-27T05:00:00.000Z')), '2026-11-27');
  assert.equal(activePromotionFor('2026-11-26')?.title, 'Thanksgiving Day Sale');
  assert.equal(activePromotionFor('2026-11-27')?.id, 'black-friday-cyber-monday');
  assert.equal(activePromotionFor('2026-11-27')?.title, 'Black Friday Sale');
  assert.equal(activePromotionFor('2026-11-30')?.id, 'black-friday-cyber-monday');
  assert.equal(activePromotionFor('2026-11-30')?.title, 'Cyber Monday Sale');
  assert.equal(activePromotionFor('2026-12-01'), null);
});

test('automatic holiday sale banners use the sale day and dates, without holiday-season spillover', () => {
  assert.equal(activePromotionFor('2026-10-30'), null);
  assert.equal(activePromotionFor('2026-10-31')?.title, 'Halloween Day Sale');
  assert.equal(activePromotionFor('2026-11-26')?.title, 'Thanksgiving Day Sale');
  assert.equal(activePromotionFor('2026-12-24'), null);
  assert.equal(activePromotionFor('2026-12-25')?.title, 'Christmas Day Sale');
  assert.equal(activePromotionFor('2026-12-26'), null);
});

test('Prime Day only appears inside the saved, operator-confirmed date range', () => {
  assert.equal(activePromotionFor('2026-07-13', '2026-07-14', '2026-07-15'), null);
  assert.equal(activePromotionFor('2026-07-14', '2026-07-14', '2026-07-15')?.id, 'prime-day');
  assert.equal(activePromotionFor('2026-07-14', '2026-07-14', '2026-07-15')?.title, 'Prime Day Sale');
  assert.equal(activePromotionFor('2026-07-15', '2026-07-14', '2026-07-15')?.id, 'prime-day');
  assert.equal(activePromotionFor('2026-07-16', '2026-07-14', '2026-07-15'), null);
});
