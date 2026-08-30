const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('scheduled provider jobs are guarded by PostgreSQL advisory locks', () => {
  const cron = read('server/services/cronService.js');
  assert.match(cron, /withAdvisoryLock/);
  assert.match(cron, /purgeExpired:\s*44001/);
  assert.match(cron, /verifyPrices:\s*44002/);
  assert.match(cron, /discoverDeals:\s*44003/);
  assert.match(cron, /runDistributed\(JOB_LOCKS\.purgeExpired/);
  assert.match(cron, /runDistributed\(JOB_LOCKS\.verifyPrices/);
  assert.match(cron, /runDistributed\(JOB_LOCKS\.discoverDeals/);
});

test('scheduled image repair is guarded by a separate distributed lock', () => {
  const source = read('server/services/imageRepairService.js');
  assert.match(source, /IMAGE_REPAIR_LOCK_ID = 44004/);
  assert.match(source, /withAdvisoryLock\(IMAGE_REPAIR_LOCK_ID/);
});

test('scheduler stop methods clear both delayed startup and recurring work', () => {
  const cron = read('server/services/cronService.js');
  const images = read('server/services/imageRepairService.js');
  assert.match(cron, /clearTimeout\(this\.initialTimeoutId\)/);
  assert.match(images, /clearTimeout\(initialTimeoutId\)/);
});

test('advisory lock helper keeps one database session for acquire and release', () => {
  const source = read('server/storage/postgres.js');
  assert.match(source, /getPool\(\)\.connect\(\)/);
  assert.match(source, /pg_try_advisory_lock/);
  assert.match(source, /pg_advisory_unlock/);
  assert.match(source, /client\.release\(\)/);
});

test('advisory lock helper executes directly without Postgres', async () => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    CLOUD_SQL_CONNECTION_NAME: process.env.CLOUD_SQL_CONNECTION_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  };
  delete process.env.DATABASE_URL;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;

  const postgres = require('../server/storage/postgres');
  const result = await postgres.withAdvisoryLock(49999, async () => 42);
  assert.deepEqual(result, { acquired: true, result: 42 });

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
