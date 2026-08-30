const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../server/db');
const queue = require('../server/repositories/publicationQueueRepository');
const worker = require('../server/services/publicationWorker');
const { CHANNELS } = require('../server/services/distributionPolicy');

const NOW = 2_000_100_000;

function verifiedDeal(overrides = {}) {
  return {
    id: 'B000000010',
    asin: 'B000000010',
    title: 'Worker Deal',
    original_price: 100,
    sale_price: 55,
    discount_percent: 45,
    quality_score: 90,
    image_url: 'https://images.example/worker.jpg',
    product_url: 'https://www.amazon.com/dp/B000000010',
    source_verified: 1,
    source_sufficient: 1,
    status: 'APPROVED',
    is_expired: 0,
    price_check_at: NOW - 10,
    created_at: NOW - 100,
    ...overrides,
  };
}

function reset() {
  delete process.env.DATABASE_URL;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  db.tables.publication_jobs = [];
  db.tables.deals = [];
}

test.beforeEach(reset);
test.after(reset);

test('worker publishes through an adapter and records external identity', async () => {
  const deal = verifiedDeal();
  db.tables.deals.push(deal);
  await queue.enqueueDeal(deal, CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });

  let payload = null;
  const result = await worker.runPublicationOnce(CHANNELS.WHATSAPP_STATUS, {
    async publish(input) {
      payload = input;
      return { externalPublicationId: 'status-777' };
    },
  }, { nowUnix: NOW });

  assert.equal(result.status, 'published');
  assert.equal(result.externalPublicationId, 'status-777');
  assert.equal(payload.deal.asin, 'B000000010');
  assert.equal(payload.channel, CHANNELS.WHATSAPP_STATUS);
  assert.equal(db.tables.publication_jobs[0].state, queue.STATES.PUBLISHED);
});

test('worker schedules retry when an adapter throws', async () => {
  const deal = verifiedDeal();
  db.tables.deals.push(deal);
  await queue.enqueueDeal(deal, CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });

  const result = await worker.runPublicationOnce(CHANNELS.WHATSAPP_STATUS, {
    async publish() { throw new Error('provider offline'); },
  }, { nowUnix: NOW, maxAttempts: 3 });

  assert.equal(result.status, 'retry_scheduled');
  assert.match(result.error, /provider offline/);
  assert.equal(db.tables.publication_jobs[0].state, queue.STATES.QUEUED);
  assert.ok(db.tables.publication_jobs[0].next_attempt_at > NOW);
});

test('worker is idle when there is nothing eligible to publish', async () => {
  const result = await worker.runPublicationOnce(CHANNELS.WHATSAPP_STATUS, { async publish() {} }, { nowUnix: NOW });
  assert.deepEqual(result, { status: 'idle', channel: CHANNELS.WHATSAPP_STATUS, jobId: null });
});

test('worker rejects adapters that do not implement publish', async () => {
  await assert.rejects(() => worker.runPublicationOnce(CHANNELS.WHATSAPP_STATUS, {}, { nowUnix: NOW }), /must expose/);
});
