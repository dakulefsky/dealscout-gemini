const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHANNELS,
  evaluateDistribution,
  selectChannelDeals,
  distributionScore,
} = require('../server/services/distributionPolicy');

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

test('all channels fail closed for unverified, expired or stale deals', () => {
  for (const channel of Object.values(CHANNELS)) {
    assert.equal(evaluateDistribution(deal({ source_verified: 0 }), channel, NOW).eligible, false);
    assert.equal(evaluateDistribution(deal({ status: 'EXPIRED', is_expired: 1 }), channel, NOW).eligible, false);
    assert.equal(evaluateDistribution(deal({ price_check_at: 0 }), channel, NOW).eligible, false);
  }
});

test('website and app accept a normal verified 15 percent deal within seven days', () => {
  const normal = deal({ discount_percent: 16, sale_price: 84, quality_score: 55, image_url: null, price_check_at: NOW - 6 * 24 * 60 * 60 });
  assert.equal(evaluateDistribution(normal, CHANNELS.WEB, NOW).eligible, true);
  assert.equal(evaluateDistribution(normal, CHANNELS.APP, NOW).eligible, true);
});

test('WhatsApp status requires a stronger, fresher, image-backed deal', () => {
  assert.equal(evaluateDistribution(deal(), CHANNELS.WHATSAPP_STATUS, NOW).eligible, true);

  const weak = evaluateDistribution(deal({ quality_score: 70, discount_percent: 18 }), CHANNELS.WHATSAPP_STATUS, NOW);
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
    deal({ id: '1', asin: 'B000000001', quality_score: 80, discount_percent: 30 }),
    deal({ id: 'duplicate', asin: 'B000000001', quality_score: 99, discount_percent: 60 }),
    deal({ id: '2', asin: 'B000000002', quality_score: 90, discount_percent: 45 }),
    deal({ id: '3', asin: 'B000000003', quality_score: 88, discount_percent: 42 }),
  ];

  const selected = selectChannelDeals(rows, CHANNELS.WHATSAPP_STATUS, {
    nowUnix: NOW,
    limit: 2,
    excludedAsins: ['B000000002'],
  });

  assert.deepEqual(selected.map((item) => item.asin), ['B000000003', 'B000000001']);
});

test('distribution score favors quality, discount and recency without random ordering', () => {
  const strongFresh = distributionScore(deal({ quality_score: 90, discount_percent: 45, price_check_at: NOW - 300 }), NOW);
  const weakerOld = distributionScore(deal({ quality_score: 75, discount_percent: 25, price_check_at: NOW - 20 * 60 * 60 }), NOW);
  assert.ok(strongFresh > weakerOld);
});

test('unsupported channels are rejected explicitly', () => {
  assert.throws(() => evaluateDistribution(deal(), 'tiktok', NOW), /Unsupported distribution channel/);
});
