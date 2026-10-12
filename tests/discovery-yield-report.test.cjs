const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const settings = require('../server/services/siteRuntimeSettingsService');
const supply = require('../server/services/departmentSupplyService');
const { fetchStrictRainforestDeals } = require('../server/services/rainforestStrictDiscovery');

const row = (asin, changes = {}) => ({ asin, title: `Kitchen tool ${asin}`, price: { value: 50 }, rrp: { value: 100 }, image: 'https://m.media-amazon.com/images/I/item.jpg', ...changes });

test('actual single-page funnel partitions exclusions and honors plain text availability', async () => {
  const originalGet = axios.get;
  const originalEnv = { RAINFOREST_API_KEY: process.env.RAINFOREST_API_KEY, AMAZON_ASSOCIATE_TAG: process.env.AMAZON_ASSOCIATE_TAG };
  let diagnostics, calls = 0;
  try {
    process.env.RAINFOREST_API_KEY = 'offline'; process.env.AMAZON_ASSOCIATE_TAG = 'test-20';
    axios.get = async () => { calls++; return { data: { deals_results: [
      row('B000000001'), row('B000000001'), row('B000000002', { availability: 'Currently unavailable' }),
      row('B000000003', { rrp: undefined }), row('bad'), row('B000000004', { title: '' }),
      row('B000000005', { price: undefined }), row('B000000006', { price: { value: 100 } }),
      row('B000000007', { price: { value: 99 } }),
      row('B000000008', { title: 'Acme Kitchen cloth pack of 2', price: { value: 99 } }),
      row('B000000009', { title: 'Acme Kitchen cloth pack of 4', price: { value: 99 } }),
    ] } }; };
    const result = await fetchStrictRainforestDeals({ minDiscount: 0, onCategories: (_rows, counts) => { diagnostics = counts; } });
    assert.equal(calls, 1);
    assert.equal(result.length, 1);
    assert.equal(diagnostics.unavailable, 1);
    assert.deepEqual(diagnostics.rejectionReasons, { missingReferencePrice: 1, invalidAsin: 1, missingTitle: 1, missingSalePrice: 1, notDiscounted: 1, belowQualityDiscount: 3 });
    assert.equal(diagnostics.qualityRejected, 3);
    assert.equal(diagnostics.quantityVariants, 0, 'rejected variants count only in quality rejections');
    const partition = ['invalidIdentityOrPrices', 'unavailable', 'belowIntakeDiscount', 'duplicateAsins', 'existingMatches', 'quantityVariants', 'qualityRejected', 'retainedNew', 'capacitySkipped'];
    assert.equal(partition.reduce((sum, key) => sum + diagnostics[key], 0), diagnostics.raw);
  } finally {
    axios.get = originalGet;
    for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('durable discovery history retains only the recent twelve paid pulls', async () => {
  settings.resetLocalSettings();
  try {
    for (let i = 0; i < 15; i++) {
      const plan = await supply.prepareDiscovery([]);
      await supply.recordDiscovery(plan, [], { raw: i, retainedNew: 1, creditsUsed: 1 });
    }
    const state = JSON.parse((await settings.get('rainforest_department_discovery')).value);
    assert.equal(state.discoveryHistory.length, 12);
    assert.equal(state.discoveryHistory[0].raw, 3);
    assert.equal(state.lastDiscovery.raw, 14);
    assert.ok(JSON.stringify(state).length <= 32768);
  } finally { settings.resetLocalSettings(); }
});

test('log report emits allowlisted counts, distinguishes scheduled intake and makes no provider calls', async () => {
  const { collect } = await import('../scripts/discovery-report.mjs');
  const payload = '[Rainforest discovery] ' + JSON.stringify({ raw: 10, retainedNew: 2, creditsUsed: 1, secret: 'DO_NOT_EMIT', rejectionReasons: { missingReferencePrice: 3, private: 99 } });
  let calls = 0;
  const report = collect({}, (command, args) => {
    calls++;
    assert.equal(command, 'gcloud');
    assert.deepEqual(args.slice(0, 2), ['logging', 'read']);
    assert.ok(args.includes('--limit=1000'));
    return { status: 0, stdout: JSON.stringify([
      { insertId: '1', textPayload: payload }, { insertId: '1', textPayload: payload },
      { textPayload: '[Deal discovery intake] {"scheduled":true,"created":2,"autoApproved":1,"pendingReview":1}' },
      { textPayload: '[Rainforest discovery] {broken}' },
    ]) };
  });
  assert.equal(calls, 1);
  assert.equal(report.groups['Rainforest discovery'].observations, 1);
  assert.equal(report.groups['Deal discovery intake (scheduled)'].totals.created, 2);
  assert.equal(report.malformed, 1);
  assert.doesNotMatch(JSON.stringify(report), /DO_NOT_EMIT|private|secret/);
  assert.throws(() => collect({}, () => ({ status: 1 })), /unavailable/);
});

test('unavailable reporting writes a visible warning and never claims zero yield', async () => {
  const { runReport } = await import('../scripts/discovery-report.mjs');
  const messages = [], summaries = [];
  const output = { log: value => messages.push(value), error: value => messages.push(value) };
  const ok = runReport({ GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: '/mock-summary' }, () => ({ status: 1, stderr: 'private credential detail' }), output, (file, text) => { assert.equal(file, '/mock-summary'); summaries.push(text); });
  assert.equal(ok, false);
  assert.match(messages.join('\n'), /::warning title=Discovery yield unavailable/);
  assert.match(summaries.join('\n'), /Maintenance success is separate/);
  assert.doesNotMatch(JSON.stringify([messages, summaries]), /private credential detail|retainedNew.*0/);
});

test('successful reporting preserves separate funnels and flags truncated evidence', async () => {
  const { runReport, reportSummary } = await import('../scripts/discovery-report.mjs');
  const summaries = [], messages = [];
  const entries = [{ textPayload: '[Rainforest discovery] {"raw":20,"retainedNew":4,"creditsUsed":1,"rejectionReasons":{"missingReferencePrice":8}}' }, { textPayload: '[Deal discovery intake] {"scheduled":true,"created":4,"autoApproved":2,"pendingReview":2}' }];
  assert.equal(runReport({ GITHUB_STEP_SUMMARY: '/mock-summary' }, () => ({ status: 0, stdout: JSON.stringify(entries) }), { log: x => messages.push(x), error: x => messages.push(x) }, (_file, text) => summaries.push(text)), true);
  const summary = summaries.join('\n');
  assert.match(summary, /Rainforest discovery/); assert.match(summary, /Deal discovery intake \(scheduled\)/);
  assert.match(summary, /\| retainedNew \| 4 \|/); assert.match(summary, /\| missingReferencePrice \| 8 \|/);
  assert.match(summary, /not a joined per-call conversion rate/);
  assert.match(reportSummary({ groups: {}, possiblyTruncated: true }), /log limit was reached/);
  assert.match(reportSummary({ groups: {} }), /does not prove that scheduled pulls ran/);
});
