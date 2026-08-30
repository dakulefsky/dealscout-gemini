const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const postgresSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'storage', 'postgres.js'), 'utf8');

test('production HTML shell is read once instead of synchronously per request', () => {
  const reads = serverSource.match(/readFileSync\(indexPath/g) || [];
  assert.equal(reads.length, 1);
  assert.match(serverSource, /const indexTemplate = fs\.readFileSync\(indexPath, 'utf8'\)/);
  assert.match(serverSource, /seo\.replaceMeta\(indexTemplate, meta\)/);
});

test('server owns an explicit graceful shutdown path', () => {
  assert.match(serverSource, /process\.once\('SIGTERM'/);
  assert.match(serverSource, /process\.once\('SIGINT'/);
  assert.match(serverSource, /dealCron\.stop\(\)/);
  assert.match(serverSource, /imageRepair\.stopImageRepairScheduler\(\)/);
  assert.match(serverSource, /httpServer\.close/);
  assert.match(serverSource, /postgres\.closePool\(\)/);
});

test('Postgres pool can be closed and recreated cleanly', () => {
  assert.match(postgresSource, /async function closePool\(\)/);
  assert.match(postgresSource, /pool = null/);
  assert.match(postgresSource, /await current\.end\(\)/);
  assert.match(postgresSource, /module\.exports = .*closePool/);
});
