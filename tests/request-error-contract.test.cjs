const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { apiResponseContract } = require('../server/middleware/apiResponseContract');
const { requestErrorHandler } = require('../server/middleware/requestErrorHandler');

test('real JSON parser failures retain client status and never log request credentials', async () => {
  const app = express();
  app.use(apiResponseContract);
  app.use(express.json({ limit: '100b' }));
  app.post('/api/v1/test', (_req, res) => res.json({ ok: true }));
  app.use(requestErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/test`;
  const originalWarn = console.warn;
  const logs = [];
  console.warn = (...parts) => logs.push(parts.join(' '));
  try {
    const invalid = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"test-sensitive-password",broken}' });
    assert.equal(invalid.status, 400);
    const body = await invalid.json();
    assert.equal(body.code, 'BAD_REQUEST');
    assert.equal(body.error, 'Invalid request');
    assert.equal(body.requestId, invalid.headers.get('x-request-id'));
    const oversized = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-sensitive-password'.repeat(10) }) });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'PAYLOAD_TOO_LARGE');
    assert.equal(logs.length, 2);
    assert.doesNotMatch(logs.join('\n'), /test-sensitive-password|broken/);
  } finally {
    console.warn = originalWarn;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('errors after response headers are sent reach Express connection cleanup', () => {
  const error = new Error('stream interrupted');
  let forwarded;
  requestErrorHandler(error, {}, { headersSent: true }, (value) => { forwarded = value; });
  assert.equal(forwarded, error);
});
