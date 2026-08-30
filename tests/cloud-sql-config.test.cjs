const test = require('node:test');
const assert = require('node:assert/strict');

function loadFreshPostgres() {
  const modulePath = require.resolve('../server/storage/postgres');
  delete require.cache[modulePath];
  return require('../server/storage/postgres');
}

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('Cloud SQL settings build a Unix socket pg configuration without nested SSL', () => {
  withEnv({
    CLOUD_SQL_CONNECTION_NAME: 'project:us-central1:dealscout-db',
    DB_USER: 'dealscout',
    DB_PASSWORD: 'secret-password',
    DB_NAME: 'dealscout',
    DATABASE_URL: undefined,
    PG_POOL_MAX: '4',
  }, () => {
    const postgres = loadFreshPostgres();
    assert.equal(postgres.isConfigured(), true);
    assert.deepEqual(postgres.getPoolConfig(), {
      host: '/cloudsql/project:us-central1:dealscout-db',
      user: 'dealscout',
      password: 'secret-password',
      database: 'dealscout',
      max: 4,
      ssl: false,
    });
  });
});

test('partial Cloud SQL settings do not override a valid DATABASE_URL', () => {
  withEnv({
    CLOUD_SQL_CONNECTION_NAME: 'project:us-central1:dealscout-db',
    DB_USER: 'dealscout',
    DB_PASSWORD: undefined,
    DB_NAME: 'dealscout',
    DATABASE_URL: 'postgresql://user:pass@example.com/dealscout',
    PGSSL: 'disable',
  }, () => {
    const postgres = loadFreshPostgres();
    assert.equal(postgres.isConfigured(), true);
    assert.deepEqual(postgres.getPoolConfig(), {
      connectionString: 'postgresql://user:pass@example.com/dealscout',
      ssl: false,
      max: 5,
    });
  });
});

test('database is unconfigured without a complete Cloud SQL config or DATABASE_URL', () => {
  withEnv({
    CLOUD_SQL_CONNECTION_NAME: undefined,
    DB_USER: undefined,
    DB_PASSWORD: undefined,
    DB_NAME: undefined,
    DATABASE_URL: undefined,
  }, () => {
    const postgres = loadFreshPostgres();
    assert.equal(postgres.isConfigured(), false);
    assert.equal(postgres.getPoolConfig(), null);
  });
});