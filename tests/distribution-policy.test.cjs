const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHANNELS,
  CHANNEL_POLICY,
  evaluateDistribution,
  selectChannelDeals,
  distributionScore,
  dealDiscountPercent,
} = require('../server/services/distributionPolicy');
const { PUBLIC_PRICE_MAX_AGE_SECONDS } = require('../server/services/publicDealPolicy');

const NOW = 2_000_000_000;

function deal(overrides = {}) {
  return {
    id: 'B000000001', asin: 'B000000001', title: 'Verified Deal', category: 'Electronics', status: 'APPROVED',
    source_verified: 1, is_expired: 0, original_price: 100, sale_price: 60, discount_percent: 40,
    quality_score: 90, image_url: 'https://images.example/deal.jpg', price_check_at: NOW - 60 * 60, ...overrides,
  };
}

test('web and app keep the public 24-hour price freshness ceiling', () => {
  for (const channel of [CHANNELS.WEB, CHANNELS.APP]) {
    assert.equal(CHANNEL_POLICY[channel].maxFreshnessSeconds, PUBLIC_PRICE_MAX_AGE_SECONDS);
    assert.equal(evaluateDistribution(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS }), channel, NOW).eligible, true);
    assert.equal(evaluateDistribution(deal({ price_check_at: NOW - PUBLIC_PRICE_MAX_AGE_SECONDS - 1 }), channel, NOW).eligible, false);
  }
});

test('all channels fail closed for unverified, expired or malformed-price deals', () => {
  for (const channel of Object.values(CHANNELS)) {
    assert.equal(evaluateDistribution(deal({ source_verified: 0 }), channel, NOW).eligible, false);
    assert.equal(evaluateDistribution(deal({ status: 'EXPIRED', is_expired: 1 }), channel, NOW).eligible, false);
    const malformed = evaluateDistribution(deal({ original_price: 100, sale_price: 120 }), channel, NOW);
    assert.equal(malformed.eligible, false);
    assert.ok(malformed.reasons.includes('invalid_price_pair'));
  }
});

test('channel discount eligibility is derived from the live price pair, not stale stored metadata', () => {
  const staleClaim = deal({ original_price: 100, sale_price: 85, discount_percent: 50, quality_score: 95 });
  assert.equal(dealDiscountPercent(staleClaim), 15);
  const whatsapp = evaluateDistribution(staleClaim, CHANNELS.WHATSAPP_STATUS, NOW);
  assert.equal(whatsapp.eligible, false);
  assert.ok(whatsapp.reasons.includes('discount_below_channel_minimum'));
});

test('website and app accept a normal verified 15 percent deal', () => {
  const normal = deal({ sale_price: 84, quality_score: 55, image_url: null, price_check_at: NOW - 20 * 60 * 60 });
  assert.equal(evaluateDistribution(normal, CHANNELS.WEB, NOW).eligible, true);
  assert.equal(evaluateDistribution(normal, CHANNELS.APP, NOW).eligible, true);
});

test('WhatsApp group is curated while Status is cream-of-the-crop', () => {
  const groupOnly = deal({ sale_price: 78, quality_score: 80, price_check_at: NOW - 10 * 60 * 60 });
  assert.equal(evaluateDistribution(groupOnly, CHANNELS.WHATSAPP_GROUP, NOW).eligible, true);
  assert.equal(evaluateDistribution(groupOnly, CHANNELS.WHATSAPP_STATUS, NOW).eligible, false);

  const showcase = deal({ sale_price: 70, quality_score: 92, price_check_at: NOW - 2 * 60 * 60 });
  assert.equal(evaluateDistribution(showcase, CHANNELS.WHATSAPP_GROUP, NOW).eligible, true);
  assert.equal(evaluateDistribution(showcase, CHANNELS.WHATSAPP_STATUS, NOW).eligible, true);

  assert.ok(CHANNEL_POLICY[CHANNELS.WHATSAPP_STATUS].minDiscountPercent > CHANNEL_POLICY[CHANNELS.WHATSAPP_GROUP].minDiscountPercent);
  assert.ok(CHANNEL_POLICY[CHANNELS.WHATSAPP_STATUS].minQualityScore > CHANNEL_POLICY[CHANNELS.WHATSAPP_GROUP].minQualityScore);
  assert.ok(CHANNEL_POLICY[CHANNELS.WHATSAPP_STATUS].maxFreshnessSeconds < CHANNEL_POLICY[CHANNELS.WHATSAPP_GROUP].maxFreshnessSeconds);
});

test('WhatsApp surfaces exclude womens clothing without removing it from web or app', () => {
  const womensDress = deal({ title: "Women's Summer Dress", category: 'Clothing & Accessories', sale_price: 60, quality_score: 95 });
  assert.equal(evaluateDistribution(womensDress, CHANNELS.WEB, NOW).eligible, true);
  assert.equal(evaluateDistribution(womensDress, CHANNELS.APP, NOW).eligible, true);
  for (const channel of [CHANNELS.WHATSAPP_GROUP, CHANNELS.WHATSAPP_STATUS]) {
    const result = evaluateDistribution(womensDress, channel, NOW);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('whatsapp_audience_excluded'));
  }
});

test('mens and neutral clothing are not accidentally excluded from WhatsApp', () => {
  assert.equal(evaluateDistribution(deal({ title: "Men's Winter Gloves", category: 'Clothing & Accessories' }), CHANNELS.WHATSAPP_STATUS, NOW).eligible, true);
  assert.equal(evaluateDistribution(deal({ title: 'Kids Winter Socks', category: 'Clothing & Accessories' }), CHANNELS.WHATSAPP_STATUS, NOW).eligible, true);
});

test('WhatsApp freshness is stricter than the public catalog', () => {
  const fifteenHoursOld = deal({ price_check_at: NOW - 15 * 60 * 60 });
  assert.equal(evaluateDistribution(fifteenHoursOld, CHANNELS.WEB, NOW).eligible, true);
  assert.equal(evaluateDistribution(fifteenHoursOld, CHANNELS.WHATSAPP_GROUP, NOW).eligible, true);
  assert.equal(evaluateDistribution(fifteenHoursOld, CHANNELS.WHATSAPP_STATUS, NOW).eligible, false);
});

test('channel selection deduplicates ASINs, respects exclusions and ranks strongest eligible deals', () => {
  const rows = [
    deal({ id: '1', asin: 'B000000001', quality_score: 88, sale_price: 70 }),
    deal({ id: 'duplicate', asin: 'B000000001', quality_score: 99, sale_price: 40 }),
    deal({ id: '2', asin: 'B000000002', quality_score: 95, sale_price: 55 }),
    deal({ id: '3', asin: 'B000000003', quality_score: 92, sale_price: 58 }),
  ];
  const selected = selectChannelDeals(rows, CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW, limit: 2, excludedAsins: ['B000000002'] });
  assert.deepEqual(selected.map((item) => item.asin), ['B000000003', 'B000000001']);
});

test('distribution score favors quality, discount and recency without random ordering', () => {
  const strongFresh = distributionScore(deal({ quality_score: 95, sale_price: 55, price_check_at: NOW - 300 }), NOW);
  const weakerOld = distributionScore(deal({ quality_score: 78, sale_price: 75, price_check_at: NOW - 20 * 60 * 60 }), NOW);
  assert.ok(strongFresh > weakerOld);
});

test('unsupported channels are rejected explicitly', () => {
  assert.throws(() => evaluateDistribution(deal(), 'tiktok', NOW), /Unsupported distribution channel/);
});
