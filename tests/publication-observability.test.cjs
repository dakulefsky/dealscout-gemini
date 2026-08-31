const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const metrics = require('../server/repositories/publicationMetricsRepository');

const NOW = 1_800_000_000;

test('publication health distinguishes overdue, retrying, failed and successful work', async () => {
  metrics.__setFallbackJobsForTests([
    { status: 'queued', scheduled_at: NOW - 100, next_attempt_at: NOW - 10 },
    { status: 'queued', scheduled_at: NOW + 100, next_attempt_at: NOW + 100 },
    { status: 'failed', scheduled_at: NOW - 200, next_attempt_at: NOW - 200 },
    { status: 'published', scheduled_at: NOW - 300, published_at: NOW - 30 },
  ]);

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
