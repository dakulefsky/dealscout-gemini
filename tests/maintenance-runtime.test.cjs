const test = require('node:test');
const assert = require('node:assert/strict');
const { runMaintenanceOnce } = require('../server/services/maintenanceRuntime');

function dependencies(result, startupError) {
  const calls = [];
  return { calls,
    bootstrap: { async initializeRuntime(options) { calls.push(['startup', options]); if (startupError) throw startupError; } },
    cron: { async runFullCycle(options) { calls.push(['cycle', options]); return result; }, stop() { calls.push(['stop']); } },
    postgres: { async closePool() { calls.push(['close']); } },
  };
}
test('maintenance uses scheduled cadence and accepts budget deferrals without forcing paid calls', async () => {
  const deps = dependencies({ discovery: { status: 'DEFERRED', code: 'PROVIDER_BUDGET_EXCEEDED' }, verification: { skipped: true, reason: 'NOT_DUE' } });
  await runMaintenanceOnce(deps);
  assert.deepEqual(deps.calls, [['startup', { isProduction: true, role: 'maintenance' }], ['cycle', { scheduled: true }], ['stop'], ['close']]);
});
test('a real maintenance lane error fails the job and closes all resources', async () => {
  const deps = dependencies({ discovery: { status: 'NOTICE', error: 'network failed' } });
  await assert.rejects(runMaintenanceOnce(deps), /Maintenance lanes failed: discovery/);
  assert.deepEqual(deps.calls.slice(-2), [['stop'], ['close']]);
});
test('startup failure also closes the database without attempting a provider cycle', async () => {
  const deps = dependencies({}, new Error('database unavailable'));
  await assert.rejects(runMaintenanceOnce(deps), /database unavailable/);
  assert.deepEqual(deps.calls.map(([key]) => key), ['startup', 'stop', 'close']);
});
test('maintenance production role needs PostgreSQL but does not need web authentication secrets', () => {
  const { validateProductionRuntime } = require('../server/config/runtimeRequirements');
  assert.deepEqual(validateProductionRuntime({}, { postgresConfigured: true, role: 'maintenance' }), []);
  assert.ok(validateProductionRuntime({}, { postgresConfigured: false, role: 'maintenance' }).some((s) => /PostgreSQL/.test(s)));
});
