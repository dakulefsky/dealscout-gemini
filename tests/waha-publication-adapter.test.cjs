const test = require('node:test');
const assert = require('node:assert/strict');

const { resolvePublicationWorkerConfig } = require('../server/config/publicationWorker');
const { createPublicationAdapter } = require('../server/adapters/publicationAdapterFactory');
const { createWahaStatusPublicationAdapter } = require('../server/adapters/wahaStatusPublicationAdapter');

test('WAHA worker config is Status-only and fails closed in production', () => {
  const config = resolvePublicationWorkerConfig({
    PUBLICATION_CHANNEL: 'whatsapp_status',
    PUBLICATION_TRANSPORT: 'waha',
    WAHA_BASE_URL: 'https://waha.example',
    WAHA_API_KEY: '0123456789abcdef',
    WAHA_SESSION: 'dealscout-status',
    WAHA_TIMEOUT_MS: '20000',
  }, { isProduction: true });

  assert.equal(config.transport, 'waha');
  assert.equal(config.wahaBaseUrl, 'https://waha.example/');
  assert.equal(config.wahaSession, 'dealscout-status');
  assert.equal(config.wahaTimeoutMs, 20000);
  assert.equal(config.minPublishSpacingSeconds, 1800);
  assert.equal(config.maxPublishesPerCycle, 1);

  assert.throws(() => resolvePublicationWorkerConfig({
    PUBLICATION_CHANNEL: 'app',
    PUBLICATION_TRANSPORT: 'waha',
    WAHA_BASE_URL: 'https://waha.example',
    WAHA_API_KEY: '0123456789abcdef',
    WAHA_SESSION: 'dealscout-status',
  }, { isProduction: true }), /only supports.*whatsapp_status/);

  assert.throws(() => resolvePublicationWorkerConfig({
    PUBLICATION_CHANNEL: 'whatsapp_status',
    PUBLICATION_TRANSPORT: 'waha',
    WAHA_BASE_URL: 'http://waha.example',
    WAHA_API_KEY: '0123456789abcdef',
    WAHA_SESSION: 'dealscout-status',
  }, { isProduction: true }), /https/);

  assert.throws(() => resolvePublicationWorkerConfig({
    PUBLICATION_CHANNEL: 'whatsapp_status',
    PUBLICATION_TRANSPORT: 'waha',
    WAHA_BASE_URL: 'https://waha.example',
    WAHA_API_KEY: 'short',
    WAHA_SESSION: 'dealscout-status',
  }, { isProduction: true }), /WAHA_API_KEY/);
});

test('WAHA adapter posts prepared factual image Status and records key.id', async () => {
  let request;
  const adapter = createWahaStatusPublicationAdapter({
    wahaBaseUrl: 'https://waha.example/',
    wahaApiKey: 'super-secret-api-key',
    wahaSession: 'dealscout-status',
    wahaTimeoutMs: 5000,
  }, {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 201,
        json: async () => ({ key: { remoteJid: 'status@broadcast', fromMe: true, id: 'WAHA-STATUS-123' } }),
      };
    },
  });

  const content = {
    channel: 'whatsapp_status',
    format: 'image_caption',
    imageUrl: 'https://images.example/deal.jpg',
    caption: 'Verified DealScout caption\nShop: https://amazon.example/item',
    facts: { asin: 'B000000001', salePrice: 49.99 },
  };
  const result = await adapter.publish({ channel: 'whatsapp_status', job: { id: 'job-1' }, content });

  assert.equal(request.url, 'https://waha.example/api/dealscout-status/status/image');
  assert.equal(request.options.headers['X-Api-Key'], 'super-secret-api-key');
  assert.equal(request.options.headers.Accept, 'application/json');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, {
    file: { mimetype: 'image/jpeg', url: content.imageUrl },
    caption: content.caption,
  });
  assert.equal(JSON.stringify(body).includes('49.99'), false, 'transport must not rebuild copy from deal facts');
  assert.equal(result.externalPublicationId, 'WAHA-STATUS-123');
});

test('WAHA adapter rejects wrong channel, incomplete content and missing external identity', async () => {
  const adapter = createWahaStatusPublicationAdapter({
    wahaBaseUrl: 'https://waha.example/',
    wahaApiKey: 'key',
    wahaSession: 'default',
  }, { fetchImpl: async () => ({ ok: true, status: 201, json: async () => ({}) }) });

  await assert.rejects(() => adapter.publish({ channel: 'app', content: {} }), /only supports whatsapp_status/);
  await assert.rejects(() => adapter.publish({ channel: 'whatsapp_status', content: { format: 'image_caption' } }), /requires prepared image_caption/);
  await assert.rejects(() => adapter.publish({
    channel: 'whatsapp_status',
    content: { format: 'image_caption', imageUrl: 'https://images.example/deal.jpg', caption: 'Deal' },
  }), /did not include a message id/);
});

test('publication adapter factory keeps webhook and WAHA replaceable', () => {
  const webhook = createPublicationAdapter({ transport: 'webhook', webhookUrl: 'https://publisher.example/hook' }, { fetchImpl: async () => {} });
  const waha = createPublicationAdapter({ transport: 'waha', wahaBaseUrl: 'https://waha.example', wahaSession: 'default' }, { fetchImpl: async () => {} });
  assert.equal(typeof webhook.publish, 'function');
  assert.equal(typeof waha.publish, 'function');
});
