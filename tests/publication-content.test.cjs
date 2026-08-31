const test = require('node:test');
const assert = require('node:assert/strict');
const { composePublicationContent, publicationFacts } = require('../server/services/publicationContentService');
const { CHANNELS } = require('../server/services/distributionPolicy');

const NOW = 2_000_100_000;

function deal(overrides = {}) {
  return {
    asin: 'B000000099',
    title: '  Excellent   Verified Gadget  ',
    category: 'Electronics',
    original_price: 100,
    sale_price: 60,
    discount_percent: 40,
    quality_score: 90,
    image_url: 'https://images.example/item.jpg',
    product_url: 'https://www.amazon.com/dp/B000000099?tag=example-20',
    source_verified: 1,
    status: 'APPROVED',
    is_expired: 0,
    price_check_at: NOW - 60,
    ...overrides,
  };
}

test('publication facts are normalized only from stored verified deal fields', () => {
  const facts = publicationFacts(deal());
  assert.equal(facts.title, 'Excellent Verified Gadget');
  assert.equal(facts.salePrice, 60);
  assert.equal(facts.originalPrice, 100);
  assert.equal(facts.savings, 40);
  assert.equal(facts.discountPercent, 40);
  assert.equal(facts.asin, 'B000000099');
});

test('WhatsApp content is concise factual copy with price disclaimer and verified destination', () => {
  const content = composePublicationContent(CHANNELS.WHATSAPP_STATUS, deal(), { nowUnix: NOW });
  assert.equal(content.format, 'image_caption');
  assert.equal(content.imageUrl, 'https://images.example/item.jpg');
  assert.match(content.caption, /Excellent Verified Gadget/);
  assert.match(content.caption, /\$60 • 40% off/);
  assert.match(content.caption, /Was \$100 • Save \$40/);
  assert.match(content.caption, /amazon\.com\/dp\/B000000099/);
  assert.match(content.caption, /Amazon pricing can change at any time/);
});

test('content composition fails closed if a deal is no longer eligible for the channel', () => {
  assert.throws(
    () => composePublicationContent(CHANNELS.WHATSAPP_STATUS, deal({ source_verified: 0 }), { nowUnix: NOW }),
    /not eligible/,
  );
  assert.throws(
    () => composePublicationContent(CHANNELS.WHATSAPP_STATUS, deal({ price_check_at: NOW - 90_000 }), { nowUnix: NOW }),
    /price_check_stale/,
  );
});

test('app content reuses the same facts without WhatsApp-specific copy', () => {
  const content = composePublicationContent(CHANNELS.APP, deal(), { nowUnix: NOW });
  assert.equal(content.format, 'deal_card');
  assert.equal(content.caption, '$60 • 40% off');
  assert.equal(content.facts.asin, 'B000000099');
});
