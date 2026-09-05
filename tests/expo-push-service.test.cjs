const test = require('node:test');
const assert = require('node:assert/strict');
const { sendExpoPush } = require('../server/services/expoPushService.js');

function okResponse(data) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  };
}

test('normalizes and sends an Expo push message', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return okResponse([{ status: 'ok', id: 'ticket-1' }]);
  };

  const result = await sendExpoPush({
    to: 'ExpoPushToken[abc123]',
    title: 'Fresh deal',
    body: '20% off',
    data: { dealId: 'deal-1' },
  }, { fetchImpl });

  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body)[0].data.dealId, 'deal-1');
  assert.equal(result.sentCount, 1);
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.failedCount, 0);
});

test('chunks Expo requests at 100 messages', async () => {
  const sizes = [];
  const fetchImpl = async (_url, options) => {
    const batch = JSON.parse(options.body);
    sizes.push(batch.length);
    return okResponse(batch.map((_, index) => ({ status: 'ok', id: `ticket-${index}` })));
  };
  const messages = Array.from({ length: 205 }, (_, index) => ({
    to: `ExpoPushToken[token-${index}]`,
    body: `Deal ${index}`,
  }));

  const result = await sendExpoPush(messages, { fetchImpl });
  assert.deepEqual(sizes, [100, 100, 5]);
  assert.equal(result.sentCount, 205);
  assert.equal(result.acceptedCount, 205);
});

test('surfaces DeviceNotRegistered tokens for cleanup', async () => {
  const fetchImpl = async () => okResponse([
    { status: 'ok', id: 'ticket-1' },
    { status: 'error', message: 'Device no longer registered', details: { error: 'DeviceNotRegistered' } },
  ]);

  const result = await sendExpoPush([
    { to: 'ExpoPushToken[good]', body: 'One' },
    { to: 'ExponentPushToken[stale]', body: 'Two' },
  ], { fetchImpl });

  assert.equal(result.failedCount, 1);
  assert.deepEqual(result.deviceNotRegisteredTokens, ['ExponentPushToken[stale]']);
});

test('rejects invalid Expo tokens before any network call', async () => {
  let called = false;
  await assert.rejects(
    sendExpoPush({ to: 'not-an-expo-token', body: 'Nope' }, { fetchImpl: async () => { called = true; } }),
    /valid Expo push token/
  );
  assert.equal(called, false);
});

test('throws a useful error on Expo HTTP failure', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ errors: [{ message: 'Rate limited' }] }),
  });
  await assert.rejects(
    sendExpoPush({ to: 'ExpoPushToken[abc]', body: 'Deal' }, { fetchImpl }),
    /Rate limited/
  );
});
