const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { RUNTIME_ROLES, validateProductionRuntime } = require('../server/config/runtimeRequirements');
const { resolvePublicationWorkerConfig } = require('../server/config/publicationWorker');
const { createWebhookPublicationAdapter } = require('../server/adapters/webhookPublicationAdapter');
const { runPublicationCycle } = require('../server/services/publicationWorkerRuntime');

const workerEntry = fs.readFileSync(path.join(__dirname, '..', 'publication-worker.js'), 'utf8');
const dockerfile = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
const packageJson = require('../package.json');

test('publication worker production role does not require website-only secrets', () => {
  const errors = validateProductionRuntime({}, {
    postgresConfigured: true,
    role: RUNTIME_ROLES.PUBLICATION_WORKER,
  });
  assert.deepEqual(errors, []);

  const webErrors = validateProductionRuntime({}, {
    postgresConfigured: true,
    role: RUNTIME_ROLES.WEB,
  });
  assert.ok(webErrors.some((message) => /JWT_SECRET/.test(message)));
  assert.ok(webErrors.some((message) => /AMAZON_ASSOCIATE_TAG/.test(message)));
});

test('publication worker configuration is explicit, bounded and HTTPS in production', () => {
  const config = resolvePublicationWorkerConfig({
    NODE_ENV: 'production',
    PUBLICATION_CHANNEL: 'whatsapp_status',
    PUBLICATION_TRANSPORT: 'webhook',
    PUBLICATION_RUN_MODE: 'once',
    PUBLICATION_WEBHOOK_URL: 'https://publisher.example/hook',
    PUBLICATION_WEBHOOK_TOKEN: '0123456789abcdef',
    PUBLICATION_POLL_MS: '5000',
    PUBLICATION_QUEUE_BATCH: '3',
    PUBLICATION_MAX_PER_CYCLE: '2',
  }, { isProduction: true });

  assert.equal(config.channel, 'whatsapp_status');
  assert.equal(config.runMode, 'once');
  assert.equal(config.pollMs, 5000);
  assert.equal(config.queueBatch, 3);
  assert.equal(config.maxPublishesPerCycle, 2);
  assert.throws(() => resolvePublicationWorkerConfig({
    PUBLICATION_CHANNEL: 'whatsapp_status',
    PUBLICATION_TRANSPORT: 'webhook',
    PUBLICATION_WEBHOOK_URL: 'http://publisher.example/hook',
    PUBLICATION_WEBHOOK_TOKEN: '0123456789abcdef',
  }, { isProduction: true }), /https/);
});

test('publication cycle feeds the queue before bounded worker draining', async () => {
  const calls = { query: null, queue: null, runs: 0 };
  const candidates = [
    { asin: 'B000000001', discount_percent: 30 },
    { asin: 'B000000002', discount_percent: 25 },
  ];
  const result = await runPublicationCycle({
    channel: 'whatsapp_status',
    candidateLimit: 50,
    queueBatch: 3,
    maxPublishesPerCycle: 4,
  }, { publish: async () => ({}) }, {
    dealQueries: {
      async list(options) {
        calls.query = options;
        return candidates;
      },
    },
    publication: {
      async queueBestDeals(channel, rows, options) {
        calls.queue = { channel, rows, options };
        return { selectedCount: 2, createdCount: 2, jobs: [] };
      },
    },
    worker: {
      async runPublicationOnce() {
        calls.runs += 1;
        return calls.runs === 1
          ? { status: 'published', channel: 'whatsapp_status', jobId: 'job-1' }
          : { status: 'idle', channel: 'whatsapp_status', jobId: null };
      },
    },
  });

  assert.equal(calls.query.minDiscount, 20);
  assert.equal(calls.query.limit, 50);
  assert.equal(calls.queue.channel, 'whatsapp_status');
  assert.deepEqual(calls.queue.rows, candidates);
  assert.equal(calls.queue.options.limit, 3);
  assert.equal(calls.runs, 2);
  assert.equal(result.enqueued, 2);
  assert.equal(result.published, 1);
});

test('webhook transport sends a versioned idempotent envelope and returns external identity', async () => {
  let request;
  const adapter = createWebhookPublicationAdapter({
    webhookUrl: 'https://publisher.example/hook',
    webhookToken: 'secret-token-value',
    webhookTimeoutMs: 5000,
  }, {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => ({ externalPublicationId: 'wa-123' }),
      };
    },
  });

  const result = await adapter.publish({
    channel: 'whatsapp_status',
    job: { id: 'job-1', idempotency_key: 'idem-1', asin: 'B000000001', source_price_check_at: 123 },
    content: { channel: 'whatsapp_status', facts: { asin: 'B000000001' }, caption: 'Deal', format: 'image_caption' },
  });

  assert.equal(request.url, 'https://publisher.example/hook');
  assert.equal(request.options.headers['Idempotency-Key'], 'idem-1');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-token-value');
  const body = JSON.parse(request.options.body);
  assert.equal(body.version, 1);
  assert.equal(body.channel, 'whatsapp_status');
  assert.equal(body.job.asin, 'B000000001');
  assert.equal(JSON.stringify(body).includes('secret-token-value'), false);
  assert.equal(result.externalPublicationId, 'wa-123');
});

test('production image and scripts expose a graceful standalone publisher process', () => {
  assert.equal(packageJson.scripts.publisher, 'node publication-worker.js');
  assert.match(dockerfile, /server\.js publication-worker\.js/);
  assert.match(workerEntry, /RUNTIME_ROLES\.PUBLICATION_WORKER/);
  assert.match(workerEntry, /runPublicationCycle/);
  assert.match(workerEntry, /runPublicationLoop/);
  assert.match(workerEntry, /process\.once\('SIGTERM'/);
  assert.match(workerEntry, /process\.once\('SIGINT'/);
  assert.match(workerEntry, /await postgres\.closePool\(\)/);
});
