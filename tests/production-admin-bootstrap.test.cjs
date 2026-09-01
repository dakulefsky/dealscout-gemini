const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const postgres = require('../server/storage/postgres');
const users = require('../server/repositories/userRepository');

const originalIsConfigured = postgres.isConfigured;
const originalQuery = postgres.query;
const originalWithAdvisoryLock = postgres.withAdvisoryLock;
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};

function restore() {
  postgres.isConfigured = originalIsConfigured;
  postgres.query = originalQuery;
  postgres.withAdvisoryLock = originalWithAdvisoryLock;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function acquireLockImmediately() {
  postgres.withAdvisoryLock = async (_lockId, task) => ({ acquired: true, result: await task() });
}

test.afterEach(restore);

test('bootstraps the first production admin from env with a bcrypt hash', async () => {
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_EMAIL = 'owner@example.com';
  process.env.ADMIN_PASSWORD = 'a-strong-bootstrap-password';
  postgres.isConfigured = () => true;
  acquireLockImmediately();

  let inserted = null;
  postgres.query = async (sql, params = []) => {
    if (/WHERE role = 'admin'/.test(sql)) return { rowCount: 0, rows: [] };
    if (/WHERE email = \$1/.test(sql)) return { rowCount: 0, rows: [] };
    if (/INSERT INTO users/.test(sql)) {
      inserted = params;
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const result = await users.bootstrapProductionAdmin();
  assert.equal(result.created, true);
  assert.equal(result.promoted, false);
  assert.equal(result.email, 'owner@example.com');
  assert.ok(inserted);
  assert.equal(inserted[1], 'owner@example.com');
  assert.notEqual(inserted[2], process.env.ADMIN_PASSWORD);
  assert.equal(bcrypt.compareSync(process.env.ADMIN_PASSWORD, inserted[2]), true);
});

test('does not overwrite credentials when a production admin already exists', async () => {
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_EMAIL = 'owner@example.com';
  process.env.ADMIN_PASSWORD = 'a-strong-bootstrap-password';
  postgres.isConfigured = () => true;
  acquireLockImmediately();
  let queryCount = 0;
  postgres.query = async (sql) => {
    queryCount += 1;
    if (/WHERE role = 'admin'/.test(sql)) return { rowCount: 1, rows: [{ id: 'existing-admin' }] };
    throw new Error(`Unexpected query after existing admin lookup: ${sql}`);
  };

  const result = await users.bootstrapProductionAdmin();
  assert.deepEqual(result, { created: false });
  assert.equal(queryCount, 1);
});

test('rejects incomplete or weak first-admin bootstrap configuration', async () => {
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_EMAIL = 'owner@example.com';
  process.env.ADMIN_PASSWORD = 'short';
  postgres.isConfigured = () => true;
  acquireLockImmediately();
  postgres.query = async (sql) => {
    if (/WHERE role = 'admin'/.test(sql)) return { rowCount: 0, rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  };

  await assert.rejects(users.bootstrapProductionAdmin(), /ADMIN_PASSWORD must be 12-200 characters/);
});

test('defers bootstrap cleanly when another production replica holds the lock', async () => {
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_EMAIL = 'owner@example.com';
  process.env.ADMIN_PASSWORD = 'a-strong-bootstrap-password';
  postgres.isConfigured = () => true;
  postgres.withAdvisoryLock = async () => ({ acquired: false, result: null });
  postgres.query = async () => {
    throw new Error('bootstrap queries must not run without the advisory lock');
  };

  const result = await users.bootstrapProductionAdmin();
  assert.deepEqual(result, { created: false, deferred: true });
});
