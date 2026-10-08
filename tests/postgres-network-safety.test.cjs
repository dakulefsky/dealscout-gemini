const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const vm = require('node:vm');

function loadPostgres(env = {}, Pool = require('pg').Pool) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../server/storage/postgres'), 'utf8'), {
    require: () => ({ Pool }), module, exports: module.exports, process: { env }, console, URL,
  });
  return module.exports;
}

test('a reachable TCP host that never completes PostgreSQL startup cannot hang readiness', async () => {
  const sockets = new Set();
  const server = net.createServer((socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const postgres = loadPostgres({ DATABASE_URL: `postgresql://test:test@127.0.0.1:${server.address().port}/test`, PGSSL: 'disable', PG_CONNECT_TIMEOUT_MS: '1000' });
  try {
    const started = Date.now();
    const result = await postgres.health();
    assert.equal(result.healthy, false);
    assert.match(result.error, /timeout/i);
    assert.ok(Date.now() - started < 4000, 'readiness must return a bounded failure');
  } finally {
    await postgres.closePool();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('database URL TLS parameters cannot silently disable certificate verification', () => {
  for (const param of ['sslmode=disable', 'sslmode=require', 'sslrootcert=/tmp/other', 'ssl=true']) {
    assert.throws(() => loadPostgres({ DATABASE_URL: `postgresql://test:test@example.com/test?${param}` }).getPoolConfig(), /must not override TLS/);
  }
});

test('unsafe connection limits fail with a configuration error instead of disabling bounds', () => {
  for (const [key, value] of [['PG_POOL_MAX', '1'], ['PG_POOL_MAX', 'NaN'], ['PG_CONNECT_TIMEOUT_MS', '0'], ['PG_STATEMENT_TIMEOUT_MS', '-1']]) {
    assert.throws(() => loadPostgres({ DATABASE_URL: 'postgresql://test:test@example.com/test', [key]: value }).getPoolConfig(), new RegExp(key));
  }
});

test('an advisory-lock session is destroyed if unlock fails, even when its task succeeds', async () => {
  const unlockError = new Error('connection lost on unlock');
  let releaseArgument;
  const client = {
    async query(sql) {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      throw unlockError;
    },
    release(error) { releaseArgument = error; },
  };
  class Pool { on() {} async connect() { return client; } }
  const postgres = loadPostgres({ DATABASE_URL: 'postgresql://test:test@example.com/test' }, Pool);
  const result = await postgres.withAdvisoryLock(44003, async () => 42);
  assert.equal(result.result, 42);
  assert.equal(releaseArgument, unlockError);
});
