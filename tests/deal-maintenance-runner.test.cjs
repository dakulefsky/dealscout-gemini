const test = require('node:test');
const assert = require('node:assert/strict');
const { runDealMaintenance } = require('../server/services/dealMaintenanceRunner');
const { RUNTIME_ROLES, validateProductionRuntime } = require('../server/config/runtimeRequirements');

test('maintenance runs a scheduled cycle and always releases the database pool', async () => {
  const calls = [];
  const result = await runDealMaintenance({
    initializeRuntime: async (options) => calls.push(['initialize', options]),
    runFullCycle: async (options) => { calls.push(['cycle', options]); return { discovery: { status: 'SUCCESS' } }; },
    closePool: async () => calls.push(['close']),
    role: RUNTIME_ROLES.DEAL_MAINTENANCE,
    isProduction: true,
    log: { log() {} },
  });
  assert.equal(result.discovery.status, 'SUCCESS');
  assert.deepEqual(calls, [
    ['initialize', { role: RUNTIME_ROLES.DEAL_MAINTENANCE, isProduction: true }],
    ['cycle', { scheduled: true }], ['close'],
  ]);
});

test('maintenance surfaces failed discovery and closes after startup errors', async () => {
  let closed = 0;
  const base = {
    initializeRuntime: async () => {},
    closePool: async () => { closed += 1; },
    log: { log() {} },
  };
  await assert.rejects(runDealMaintenance({
    ...base, runFullCycle: async () => ({ discovery: { status: 'NOTICE', error: 'provider failed' } }),
  }), /provider failed/);
  await assert.rejects(runDealMaintenance({
    ...base, initializeRuntime: async () => { throw new Error('database unavailable'); },
    runFullCycle: async () => { throw new Error('must not run'); },
  }), /database unavailable/);
  assert.equal(closed, 2);
});

test('maintenance production role requires database but no web listener or JWT', () => {
  assert.deepEqual(validateProductionRuntime({}, { postgresConfigured: true, role: RUNTIME_ROLES.DEAL_MAINTENANCE }), []);
  assert.match(validateProductionRuntime({}, { postgresConfigured: false, role: RUNTIME_ROLES.DEAL_MAINTENANCE }).join(' '), /PostgreSQL/);
});
