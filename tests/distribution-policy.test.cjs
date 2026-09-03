const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHANNELS,
  CHANNEL_POLICY,
  evaluateDistribution,
  selectChannelDeals,
  distributionScore,
} = require('../server/services/distributionPolicy');
const { PUBLIC_PRICE_MAX_AGE_SECONDS } = require('../server/services/publicDealPolicy');

const NOW = 2_000_000_000;

function deal(overrides = {}) {
  return {
    id: 'B000000001',
    asin: 'B000000001',
    title: 'Verified Deal',
    status: 'APPROVED',
    source_verified: 1,
    is_expired: 0,
    original_price: 100,
    sale_price: 60,
    discount_percent: 40,
    quality_score: 85,
    image_url: 'https://images.example/deal.jpg',
    price_check_at: NOW - 60 * 60,
    ...overrides,
  };
}

test('all channels share the public 24-hour price freshness ceiling', () => {
  for (const channel of Object.values(CHANNELS)) {
    assert.equal(CHANNEL_POLICY[channel].maxFreshnessSeconds, PUBLIC_PRICE_MAX_AGE_SECONDS);
    assert.equal(evaluateDistribution(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS }), channel, NOW).eligible, true);
    assert.equal(evaluateDistribution(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS - 1 }), channel, NOW).eligible, false);
    assert.equal(evaluateDistribution(deal({ price_check_at: NOW + 1 }), channel, NOW).eligible, false);
  }
});

test('all channels fail closed for unverified, expired, stale or malformed-price deals', () => {
  for (const channel of Object.values(CHANNELS)) {
    assert.equal(evaluateDistribution(deal({ source_verified: 0 }), channel, NOW).eligible, false);
    assert.equal(evaluateDistribution(deal({ status: 'EXPIRED', is_expired: 1 }), channel, NOW).eligible, false);
    assert.equal(evaluateDistribution(deal({ price_check_at: 0 }), channel, NOW).eligible, false);
    const malformed = evaluateDistribution(deal({ original_price: 100, sale_price: 120, discount_percent: 40 }), channel, NOW);
    assert.equal(malformed.eligible, false);
    assert.ok(malformed.reasons.includes('invalid_price_pair'));
  }
});

test('website and app accept a normal verified 15 percent deal only while price is fresh', () => {
  const normal = deal({ discount_percent: 16, sale_price: 84, quality_score: 55, image_url: null, price_check_at: NOW - 20 * 60 * 60 });
  assert.equal(evaluateDistribution(normal, CHANNELS.WEB, NOW).eligible, true);
  assert.equal(evaluateDistribution(normal, CHANNELS.APP, NOW).eligible, true);

  const stale = { ...normal, price_check_at: NOW - 25 * 60 * 60 };
  assert.equal(evaluateDistribution(stale, CHANNELS.WEB, NOW).eligible, false);
  assert.equal(evaluateDistribution(stale, CHANNELS.APP, NOW).eligible, false);
});

test('WhatsApp status requires a stronger, fresh, image-backed deal', () => {
  assert.equal(evaluateDistribution(deal(), CHANNELS.WHATSAPP_STATUS, NOW).eligible, true);

  const weak = evaluateDistribution(deal({ quality_score: 70, discount_percent: 18, sale_price: 82 }), CHANNELS.WHATSAPP_STATUS, NOW);
  assert.equal(weak.eligible, false);
  assert.ok(weak.reasons.includes('quality_below_channel_minimum'));
  assert.ok(weak.reasons.includes('discount_below_channel_minimum'));

  const stale = evaluateDistribution(deal({ price_check_at: NOW - 25 * 60 * 60 }), CHANNELS.WHATSAPP_STATUS, NOW);
  assert.equal(stale.eligible, false);
  assert.ok(stale.reasons.includes('price_check_stale'));

  const noImage = evaluateDistribution(deal({ image_url: null }), CHANNELS.WHATSAPP_STATUS, NOW);
  assert.equal(noImage.eligible, false);
  assert.ok(noImage.reasons.includes('image_required'));
});

test('channel selection deduplicates ASINs, respects exclusions and ranks strongest eligible deals', () => {
  const rows = [
    deal({ id: '1', asin: 'B000000001', quality_score: 80, discount_percent: 30, sale_price: 70 }),
    deal({ id: 'duplicate', asin: 'B000000001', quality_score: 99, discount_percent: 60, sale_price: 40 }),
    deal({ id: '2', asin: 'B000000002', quality_score: 90, discount_percent: 45, sale_price: 55 }),
    deal({ id: '3', asin: 'B000000003', quality_score: 88, discount_percent: 42, sale_price: 58 }),
  ];

  const selected = selectChannelDeals(rows, CHANNELS.WHATSAPP_STATUS, {
    nowUnix: NOW,
    limit: 2,
    excludedAsins: ['B000000002'],
  });

  assert.deepEqual(selected.map((item) => item.asin), ['B000000003', 'B000000001']);
});

test('distribution score favors quality, discount and recency without random ordering', () => {
  const strongFresh = distributionScore(deal({ quality_score: 90, discount_percent: 45, sale_price: 55, price_check_at: NOW - 300 }), NOW);
  const weakerOld = distributionScore(deal({ quality_score: 75, discount_percent: 25, sale_price: 75, price_check_at: NOW - 20 * 60 * 60 }), NOW);
  assert.ok(strongFresh > weakerOld);
});

test('unsupported channels are rejected explicitly', () => {
  assert.throws(() => evaluateDistribution(deal(), 'tiktok', NOW), /Unsupported distribution channel/);
});
