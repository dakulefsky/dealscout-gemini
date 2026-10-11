const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../server/services/siteRuntimeSettingsService');
const metrics = require('../server/services/discoveryIntakeMetrics');

test('actual intake metrics persist across service reloads and keep twelve completed runs', async () => {
  settings.resetLocalSettings();
  try {
    for (let i = 0; i < 15; i++) await metrics.record({ created: i, autoApproved: i, scheduled: true, secret: 'never save' });
    delete require.cache[require.resolve('../server/services/discoveryIntakeMetrics')];
    const state = await require('../server/services/discoveryIntakeMetrics').read();
    assert.equal(state.latest.created, 14);
    assert.equal(state.latest.scheduled, true);
    assert.equal(state.history.length, 12);
    assert.equal(state.history[0].created, 3);
    assert.doesNotMatch((await settings.get('deal_discovery_intake')).value, /secret|never save/);
  } finally { settings.resetLocalSettings(); }
});

test('missing or corrupt metrics never block provider status or successful intake', async () => {
  settings.resetLocalSettings();
  const originalSet = settings.set;
  try {
    await settings.set('deal_discovery_intake', 'broken');
    assert.deepEqual(await metrics.read(), { latest: null, history: [] });
    settings.set = async () => { throw new Error('database unavailable'); };
    await assert.doesNotReject(metrics.record({ created: 2 }));
  } finally { settings.set = originalSet; settings.resetLocalSettings(); }
});
