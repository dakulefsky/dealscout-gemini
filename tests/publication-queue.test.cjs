const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../server/db');
const queue = require('../server/repositories/publicationQueueRepository');
const publication = require('../server/services/publicationService');
const { CHANNELS } = require('../server/services/distributionPolicy');

const NOW = 2_000_000_000;

function verifiedDeal(overrides = {}) {
  return {
    id: 'B000000001',
    asin: 'B000000001',
    title: 'Queue Test Deal',
    category: 'Electronics',
    original_price: 100,
    sale_price: 60,
    discount_percent: 40,
    quality_score: 85,
    image_url: 'https://images.example/deal.jpg',
    product_url: 'https://www.amazon.com/dp/B000000001',
    source_provider: 'RAINFOREST',
    source_verified: 1,
    source_sufficient: 1,
    status: 'APPROVED',
    is_expired: 0,
    price_check_at: NOW - 60,
    created_at: NOW - 500,
    ...overrides,
  };
}

function resetFallback() {
  db.tables.publication_jobs = [];
  db.tables.deals = [];
}

test.beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  resetFallback();
});

test.after(() => {
  resetFallback();
});

test('enqueue is idempotent for the same channel ASIN and verification snapshot', async () => {
  const deal = verifiedDeal();
  const first = await queue.enqueueDeal(deal, CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  const duplicate = await queue.enqueueDeal(deal, CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.reason, 'duplicate');
  assert.equal(first.job.id, duplicate.job.id);
  assert.equal(db.tables.publication_jobs.length, 1);
});

test('workers lease due jobs and increment attempts', async () => {
  await queue.enqueueDeal(verifiedDeal(), CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW, scheduledAt: NOW - 1 });
  const leased = await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW, leaseSeconds: 60 });

  assert.equal(leased.state, queue.STATES.LEASED);
  assert.equal(leased.attempts, 1);
  assert.equal(leased.lease_until, NOW + 60);
  assert.equal(await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW + 30 }), null);
});

test('expired worker leases can be reclaimed after a crash', async () => {
  await queue.enqueueDeal(verifiedDeal(), CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  const first = await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW, leaseSeconds: 15 });
  const reclaimed = await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW + 16, leaseSeconds: 30 });

  assert.equal(reclaimed.id, first.id);
  assert.equal(reclaimed.attempts, 2);
  assert.equal(reclaimed.lease_until, NOW + 46);
});

test('publication failures back off and become terminal after bounded attempts', async () => {
  await queue.enqueueDeal(verifiedDeal(), CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  let job = await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  job = await queue.failJob(job.id, new Error('transport unavailable'), { nowUnix: NOW, maxAttempts: 2 });

  assert.equal(job.state, queue.STATES.QUEUED);
  assert.equal(job.next_attempt_at, NOW + queue.retryDelaySeconds(1));
  assert.equal(await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW + 30 }), null);

  job = await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: job.next_attempt_at });
  job = await queue.failJob(job.id, 'still unavailable', { nowUnix: job.lease_until, maxAttempts: 2 });
  assert.equal(job.state, queue.STATES.FAILED);
  assert.equal(job.next_attempt_at, null);
});

test('published jobs retain external publication identity and feed recent-ASIN suppression', async () => {
  await queue.enqueueDeal(verifiedDeal(), CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  const leased = await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  const published = await queue.markPublished(leased.id, { nowUnix: NOW + 5, externalPublicationId: 'wa-status-123' });

  assert.equal(published.state, queue.STATES.PUBLISHED);
  assert.equal(published.external_publication_id, 'wa-status-123');
  assert.deepEqual(await queue.recentPublishedAsins(CHANNELS.WHATSAPP_STATUS, NOW - 60), ['B000000001']);
});

test('worker revalidates against the live deal and replaces stale verification-snapshot jobs', async () => {
  const old = verifiedDeal({ price_check_at: NOW - 120 });
  db.tables.deals.push({ ...old });
  await queue.enqueueDeal(old, CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });

  db.tables.deals[0] = verifiedDeal({ price_check_at: NOW - 30 });
  const leased = await publication.leaseNextPublishable(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });

  assert.ok(leased);
  assert.equal(leased.job.source_price_check_at, NOW - 30);
  const oldJob = db.tables.publication_jobs.find((job) => job.source_price_check_at === NOW - 120);
  assert.equal(oldJob.state, queue.STATES.CANCELLED);
  assert.match(oldJob.last_error, /Verification snapshot changed/);
});

test('batch queueing excludes recently published ASINs before enqueue', async () => {
  const first = verifiedDeal({ asin: 'B000000001', id: 'B000000001' });
  const second = verifiedDeal({ asin: 'B000000002', id: 'B000000002', title: 'Second Deal', quality_score: 90 });

  await queue.enqueueDeal(first, CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  const leased = await queue.leaseNext(CHANNELS.WHATSAPP_STATUS, { nowUnix: NOW });
  await queue.markPublished(leased.id, { nowUnix: NOW });

  const batch = await publication.queueBestDeals(CHANNELS.WHATSAPP_STATUS, [first, second], {
    nowUnix: NOW,
    limit: 2,
    recentWindowSeconds: 3600,
  });

  assert.equal(batch.selectedCount, 1);
  assert.equal(batch.jobs[0].asin, 'B000000002');
});
