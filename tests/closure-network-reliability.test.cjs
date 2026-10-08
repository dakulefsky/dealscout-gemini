const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(fetch, timeout = 5000) {
  const context = { module: { exports: {} }, require: () => ({}), URL, Date, Map, Object, Number, String, Boolean, AbortController,
    fetch, setTimeout: (fn) => setTimeout(fn, timeout), clearTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/services/jewishClosureService.js'), 'utf8'), context);
  return context.module.exports;
}
const options = { location: 'jerusalem' };
test('simultaneous closure checks share one request without sharing across dates', async () => {
  let calls = 0;
  const service = load(async () => { calls++; await new Promise(r => setTimeout(r, 5)); return { ok: true, json: async () => ({ status: { isAssurBemlacha: false } }) }; });
  const date = new Date('2026-10-08T08:00:30Z');
  const statuses = await Promise.all(Array.from({ length: 20 }, () => service.currentStatus(date, options)));
  assert.equal(calls, 1);
  assert.ok(statuses.every(s => s.closed === false));
  await service.currentStatus(new Date('2026-10-07T08:00:30Z'), options);
  assert.equal(calls, 2);
});
test('malformed closure data fails closed and is not cached as open', async () => {
  let calls = 0;
  const service = load(async () => { calls++; return { ok: true, json: async () => ({ status: {} }) }; });
  for (let i = 0; i < 2; i++) await assert.rejects(service.currentStatus(new Date(), options), /valid closure status/);
  assert.equal(calls, 2);
});
test('calendar deadline includes reading the response body', async () => {
  const service = load(async (_url, { signal }) => ({ ok: true, json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) }), 10);
  await assert.rejects(service.currentStatus(new Date(), options), /timed out/);
});
