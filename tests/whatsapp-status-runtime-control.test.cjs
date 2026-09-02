const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runPublicationCycleUnlocked } = require('../server/services/publicationWorkerRuntime');

const config = {
  channel: 'whatsapp_status',
  candidateLimit: 10,
  queueBatch: 2,
  minPublishSpacingSeconds: 1800,
  maxPublishesPerCycle: 1,
};

test('paused WhatsApp Status cycle does not query, queue, or publish', async () => {
  const calls = { list: 0, queue: 0, publish: 0 };
  const result = await runPublicationCycleUnlocked(config, {}, {
    channelSettings: { async get() { return { channel: 'whatsapp_status', enabled: false }; } },
    dealQueries: { async list() { calls.list += 1; return []; } },
    publication: { async queueBestDeals() { calls.queue += 1; return { selectedCount: 0, createdCount: 0 }; } },
    worker: { async runPublicationOnce() { calls.publish += 1; return { status: 'idle' }; } },
    publicationMetrics: { async latestPublishedAt() { return null; } },
  });
  assert.equal(result.paused, true);
  assert.deepEqual(calls, { list: 0, queue: 0, publish: 0 });
});

test('channel settings endpoint is admin-only and mounted under functions', () => {
  const endpoint = fs.readFileSync(path.join(__dirname, '../server/middleware/channelSettingsEndpoint.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(endpoint, /requireAdmin\(req, res/);
  assert.match(endpoint, /whatsappStatusEnabled/);
  assert.match(server, /channelSettingsEndpoint/);
});

test('runtime bootstrap initializes durable channel settings schema', () => {
  const bootstrap = fs.readFileSync(path.join(__dirname, '../server/startup/runtimeBootstrap.js'), 'utf8');
  assert.match(bootstrap, /channelSettingsService\.ensureSchema\(\)/);
});
