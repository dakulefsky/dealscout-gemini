const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

const deal = (overrides = {}) => ({ asin: 'B012345678', title: 'Useful product', originalPrice: 100, salePrice: 80, imageUrl: 'https://example.com/a.jpg', sourceVerified: true, availability: 'In Stock', ...overrides });

test('normal verified deal takes automatic lane', () => assert.equal(scoreVerifiedDeal(deal()).decision, 'AUTO_APPROVE'));
test('bad deal takes reject lane', () => assert.equal(scoreVerifiedDeal(deal({ salePrice: 90 })).decision, 'REJECT'));
test('suspicious deal takes review lane', () => assert.equal(scoreVerifiedDeal(deal({ salePrice: 10 })).decision, 'PENDING_REVIEW'));
