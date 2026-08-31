const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const db = require('../server/db');
const metrics = require('../server/repositories/publicationMetricsRepository');

const NOW = 2_000_200_000;

function job(overrides = {}) {
  return {
    id: `job-${Math.random()}`,
    channel: 'whatsapp_status',
    asin: 'B000000010',
    source_price_check_at: NOW - 100,
    policy_version: 'distribution-v1',
    idempotency_key: `key-${Math.random()}`,
    state: 'queued',
    scheduled_at: NOW - 60,
    lease_until: null,
    attempts: 0,
    next_attempt_at: null,
    last_error: null,
    published_at: null,
    cancelled_at: null,
    snapshot_json: {},
    created_at: NOW - 120,
    updated_at: NOW - 60,
    ...overrides,
  };
}

test.beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  db.tables.publication_jobs = [];
});

test('publication health distinguishes overdue, retrying, failed and successful work', async () => {
  db.tables.publication_jobs.push(
    job({ id: 'ready', state: 'queued', scheduled_at: NOW - 100 }),
    job({ id: 'retry', state: 'queued', scheduled_at: NOW - 100, next_attempt_at: NOW + 300 }),
    job({ id: 'failed', state: 'failed', scheduled_at: NOW - 500, last_error: 'provider offline' }),
    job({ id: 'published', state: 'published', scheduled_at: NOW - 900, published_at: NOW - 30 }),
  );

  const health = await metrics.health({ nowUnix: NOW });
  assert.equal(health.total, 4);
  assert.deepEqual(health.counts, { queued: 2, leased: 0, published: 1, failed: 1, cancelled: 0 });
  assert.equal(health.overdue, 1);
  assert.equal(health.retryWaiting, 1);
  assert.equal(health.oldestQueuedAt, NOW - 100);
  assert.equal(health.lastPublishedAt, NOW - 30);
});

test('admin wiring keeps publication health private and failure-aware', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const endpoint = fs.readFileSync(path.join(__dirname, '..', 'server', 'middleware', 'publicationHealthEndpoint.js'), 'utf8');
  const apiCore = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'apiCore.js'), 'utf8');
  const admin = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'AdminHome.jsx'), 'utf8');

  assert.match(server, /publicationHealthEndpoint/);
  assert.match(endpoint, /requireAdmin\(req, res/);
  assert.match(endpoint, /publicationMetrics\.health\(\)/);
  assert.match(apiCore, /publicationHealth:\s*\(\) => api\.get\('\/api\/functions\/publication-health'\)/);
  assert.match(admin, /\['publication health', functions\.publicationHealth\(\)\]/);
  assert.match(admin, /Publication automation/);
  assert.match(admin, /publicationUnavailable/);
  assert.match(admin, /Failed or overdue jobs/);
});
