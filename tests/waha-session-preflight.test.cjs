const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createWahaStatusPublicationAdapter } = require('../server/adapters/wahaStatusPublicationAdapter');
const { createPublicationAdapter } = require('../server/adapters/publicationAdapterFactory');

const workerEntry = fs.readFileSync(path.join(__dirname, '..', 'publication-worker.js'), 'utf8');

function adapterWithResponse(response) {
  let request;
  const adapter = createWahaStatusPublicationAdapter({
    wahaBaseUrl: 'https://waha.example/',
    wahaApiKey: 'super-secret-api-key',
    wahaSession: 'dealscout-status',
    wahaTimeoutMs: 5000,
  }, {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response;
    },
  });
  return { adapter, request: () => request };
}

test('WAHA preflight verifies the configured session is WORKING', async () => {
  const setup = adapterWithResponse({
    ok: true,
    status: 200,
    json: async () => ({ name: 'dealscout-status', status: 'WORKING', engine: { engine: 'WEBJS' } }),
  });

  const result = await setup.adapter.preflight();
  const request = setup.request();
  assert.equal(request.url, 'https://waha.example/api/sessions/dealscout-status');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers['X-Api-Key'], 'super-secret-api-key');
  assert.equal(result.status, 'WORKING');
  assert.equal(result.session, 'dealscout-status');
  assert.equal(result.engine, 'WEBJS');
});

test('WAHA preflight fails startup for unpaired or unhealthy session states', async () => {
  for (const status of ['STOPPED', 'STARTING', 'SCAN_QR_CODE', 'FAILED']) {
    const { adapter } = adapterWithResponse({ ok: true, status: 200, json: async () => ({ name: 'dealscout-status', status }) });
    await assert.rejects(() => adapter.preflight(), (error) => {
      assert.equal(error.code, 'WAHA_SESSION_NOT_WORKING');
      assert.equal(error.sessionStatus, status);
      return true;
    });
  }
});

test('WAHA preflight distinguishes HTTP connectivity/auth failures', async () => {
  const { adapter } = adapterWithResponse({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(() => adapter.preflight(), (error) => {
    assert.equal(error.code, 'WAHA_PREFLIGHT_HTTP_ERROR');
    assert.equal(error.status, 401);
    return true;
  });
});

test('only adapters that expose preflight are checked by the worker lifecycle', () => {
  const webhook = createPublicationAdapter({ transport: 'webhook', webhookUrl: 'https://publisher.example/hook' }, { fetchImpl: async () => {} });
  const waha = createPublicationAdapter({ transport: 'waha', wahaBaseUrl: 'https://waha.example', wahaSession: 'default' }, { fetchImpl: async () => {} });
  assert.equal(webhook.preflight, undefined);
  assert.equal(typeof waha.preflight, 'function');
  assert.match(workerEntry, /typeof adapter\.preflight === 'function'/);
  assert.match(workerEntry, /await adapter\.preflight\(\)/);
});
