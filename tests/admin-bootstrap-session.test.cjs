const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadModule(path, dependencies, env) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve(path), 'utf8'), {
    require: (name) => dependencies[name] || require(name),
    module, exports: module.exports, process: { env }, console, URL,
  });
  return module.exports;
}

for (const scenario of ['existing admin', 'new admin', 'promoted user', 'failed lookup']) {
  test(`production startup reuses its warmed lock session: ${scenario}`, async () => {
    const statements = [];
    let connections = 0;
    let released = 0;
    let leased = false;
    let writeParams;
    const client = {
      async query(sql, params) {
        statements.push(sql);
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
        if (sql.includes("WHERE role = 'admin'")) {
          if (scenario === 'failed lookup') throw new Error('lookup failed');
          return { rowCount: scenario === 'existing admin' ? 1 : 0, rows: [{ id: 'admin' }] };
        }
        if (sql.includes('WHERE email = $1')) {
          return { rowCount: scenario === 'promoted user' ? 1 : 0, rows: [{ id: 'user' }] };
        }
        if (/INSERT INTO users|UPDATE users SET password/.test(sql)) writeParams = params;
        return { rows: [{ count: 1 }], rowCount: 1 };
      },
      release() { released += 1; leased = false; },
    };
    class Pool {
      on() {}
      async connect() {
        connections += 1;
        if (connections > 1) throw new Error('cold second connection timed out');
        leased = true;
        return client;
      }
      async query(sql, params) {
        if (leased) throw new Error('cold second connection timed out');
        return client.query(sql, params);
      }
    }
    const env = {
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://test:test@example.com/test',
      ADMIN_EMAIL: 'owner@example.com', ADMIN_PASSWORD: 'test-bootstrap-password',
    };
    const postgres = loadModule('../server/storage/postgres', { pg: { Pool } }, env);
    const users = loadModule('../server/repositories/userRepository', {
      '../storage/postgres': postgres,
      '../db': { tables: {} },
      '../services/demoSeedPolicy': { demoSeedAllowed: () => false, isLegacyDemoAdmin: () => false },
      bcryptjs: { hash: async () => 'test-hash' },
      uuid: { v4: () => 'new-admin-id' },
    }, env);
    assert.equal((await postgres.health()).healthy, true);
    if (scenario === 'failed lookup') {
      await assert.rejects(users.ensureSchema(), /lookup failed/);
    } else {
      await users.ensureSchema();
      assert.equal(Boolean(writeParams), scenario !== 'existing admin');
      if (scenario === 'promoted user') assert.equal(writeParams[1], 'user');
      if (scenario === 'new admin') assert.equal(writeParams[1], 'owner@example.com');
    }
    assert.equal(connections, 1, 'bootstrap must not request another connection while holding its lock');
    assert.equal(released, 1);
    assert.ok(statements.at(-1).includes('pg_advisory_unlock'), 'release lock on success and failure');
  });
}
