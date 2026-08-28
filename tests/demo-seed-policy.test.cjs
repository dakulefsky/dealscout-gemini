const test = require('node:test');
const assert = require('node:assert/strict');

const policyPath = require.resolve('../server/services/demoSeedPolicy');
const repoPath = require.resolve('../server/repositories/dealRepository');

function reload(modulePath) {
  delete require.cache[modulePath];
  return require(modulePath);
}

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return fn(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('demo seed is disabled by default', () => withEnv({ NODE_ENV: 'development', ALLOW_DEMO_SEED: undefined }, () => {
  const { demoSeedAllowed } = reload(policyPath);
  assert.equal(demoSeedAllowed(), false);
}));

test('demo seed requires an explicit development-only flag', () => {
  withEnv({ NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' }, () => {
    const { demoSeedAllowed } = reload(policyPath);
    assert.equal(demoSeedAllowed(), true);
  });
  withEnv({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' }, () => {
    const { demoSeedAllowed } = reload(policyPath);
    assert.equal(demoSeedAllowed(), false);
  });
});

test('legacy demo deals cannot bootstrap unless demo mode is explicitly enabled', () => {
  const fakeDeal = { id: 'B000000000', asin: 'B000000000', title: 'Synthetic demo', original_price: 20, sale_price: 10 };
  withEnv({ NODE_ENV: 'development', ALLOW_DEMO_SEED: undefined }, () => {
    delete require.cache[repoPath];
    const { shouldBootstrapDeal } = require('../server/repositories/dealRepository');
    assert.equal(shouldBootstrapDeal(fakeDeal), false);
  });
  withEnv({ NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' }, () => {
    delete require.cache[repoPath];
    const { shouldBootstrapDeal } = require('../server/repositories/dealRepository');
    assert.equal(shouldBootstrapDeal(fakeDeal), true);
  });
  withEnv({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' }, () => {
    delete require.cache[repoPath];
    const { shouldBootstrapDeal } = require('../server/repositories/dealRepository');
    assert.equal(shouldBootstrapDeal(fakeDeal), false);
  });
});

test('legacy demo admin is identified explicitly', () => {
  const { isLegacyDemoAdmin } = reload(policyPath);
  assert.equal(isLegacyDemoAdmin({ id: 'usr-admin-1', email: 'other@example.com' }), true);
  assert.equal(isLegacyDemoAdmin({ id: 'x', email: 'ADMIN@DEALSCOUT.LOCAL' }), true);
  assert.equal(isLegacyDemoAdmin({ id: 'x', email: 'real@example.com' }), false);
});
