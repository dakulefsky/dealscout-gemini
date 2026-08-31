const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../server/db');
const metrics = require('../server/repositories/publicationMetricsRepository');
const { WHATSAPP_STATUS_PUBLICATION_LOCK, runPublicationCycle } = require('../server/services/publicationWorkerRuntime');

const NOW = 2_000_000_000;

function dependencies(overrides = {}) {
  return {
    nowUnix: () => NOW,
    postgres: {
      async withAdvisoryLock(lockId, task) {
        return { acquired: true, result: await task(), lockId };
      },
    },
    publicationMetrics: { async latestPublishedAt() { return null; } },
    dealQueries: { async list() { return []; } },
    publication: { async queueBestDeals() { return { selectedCount: 0, createdCount: 0, jobs: [] }; } },
    worker: { async runPublicationOnce() { return { status: 'idle' }; } },
    ...overrides,
  };
}

test.beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;
  db.tables.publication_jobs = [];
});

test('per-surface metrics return the latest WhatsApp Status publication time', async () => {
  db.tables.publication_jobs.push(
    { channel: 'app', state: 'published', published_at: NOW - 10 },
    { channel: 'whatsapp_status', state: 'published', published_at: NOW - 1200 },
    { channel: 'whatsapp_status', state: 'published', published_at: NOW - 600 },
  );
  assert.equal(await metrics.latestPublishedAt('whatsapp_status'), NOW - 600);
});

test('Status cycle defers transport until the durable spacing window expires', async () => {
  let runs = 0;
  const result = await runPublicationCycle({
    channel: 'whatsapp_status', candidateLimit: 20, queueBatch: 2,
    maxPublishesPerCycle: 5, minPublishSpacingSeconds: 1800,
  }, {}, dependencies({
    publicationMetrics: { async latestPublishedAt() { return NOW - 600; } },
    worker: { async runPublicationOnce() { runs += 1; return { status: 'published' }; } },
  }));
  assert.equal(runs, 0);
  assert.equal(result.cadenceDeferred, true);
  assert.equal(result.nextPublishEligibleAt, NOW + 1200);
});

test('Status runtime publishes at most one item even when config asks for more', async () => {
  let runs = 0;
  const result = await runPublicationCycle({
    channel: 'whatsapp_status', candidateLimit: 20, queueBatch: 2,
    maxPublishesPerCycle: 9, minPublishSpacingSeconds: 0,
  }, {}, dependencies({
    worker: { async runPublicationOnce() { runs += 1; return { status: 'published' }; } },
  }));
  assert.equal(runs, 1);
  assert.equal(result.published, 1);
});

test('Status cycles use one distributed advisory lock across worker replicas', async () => {
  let lockId;
  const result = await runPublicationCycle({ channel: 'whatsapp_status' }, {}, dependencies({
    postgres: {
      async withAdvisoryLock(id) {
        lockId = id;
        return { acquired: false, result: null };
      },
    },
  }));
  assert.equal(lockId, WHATSAPP_STATUS_PUBLICATION_LOCK);
  assert.equal(result.coordinationDeferred, true);
  assert.equal(result.published, 0);
});
