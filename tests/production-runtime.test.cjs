const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { validateProductionRuntime } = require('../server/config/runtimeRequirements');
const bootstrapSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'startup', 'runtimeBootstrap.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const jsonDbSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'db.js'), 'utf8');
const qualityWorkflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'quality.yml'), 'utf8');
const dockerfile = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');

test('production runtime requires durable shared PostgreSQL state', () => {
  const base = {
    JWT_SECRET: 'x'.repeat(32),
    AMAZON_ASSOCIATE_TAG: 'dealscout-20',
    FRONTEND_URL: 'https://deals.example',
    PORT: '8080',
  };
  assert.deepEqual(validateProductionRuntime(base, { postgresConfigured: true }), []);
  assert.ok(validateProductionRuntime(base, { postgresConfigured: false }).some((message) => /PostgreSQL/.test(message)));
});

test('production runtime rejects unsafe or malformed deployment values', () => {
  const errors = validateProductionRuntime({
    JWT_SECRET: 'short',
    AMAZON_ASSOCIATE_TAG: '',
    FRONTEND_URL: 'http://example.com',
    PORT: '99999',
  }, { postgresConfigured: false });
  assert.ok(errors.some((message) => /JWT_SECRET/.test(message)));
  assert.ok(errors.some((message) => /AMAZON_ASSOCIATE_TAG/.test(message)));
  assert.ok(errors.some((message) => /PostgreSQL/.test(message)));
  assert.ok(errors.some((message) => /https/.test(message)));
  assert.ok(errors.some((message) => /PORT/.test(message)));
});

test('startup initializes every shared operational schema before serving traffic', () => {
  for (const marker of [
    'dealRepository.ensureSchema()',
    'userRepository.ensureSchema()',
    'categoryRepository.ensureSchema()',
    'bookmarkRepository.ensureSchema()',
    'editorialRepository.ensureSchema()',
    'activityRepository.ensureSchema()',
    'refreshStateRepository.ensureSchema()',
    'publicationQueueRepository.ensureSchema()',
    'priceHistoryService.ensureSchema()',
  ]) assert.match(bootstrapSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(serverSource, /await runtimeBootstrap\.initializeRuntime\(\{ isProduction \}\)/);
});

test('liveness stays process-only while readiness checks dependencies', () => {
  assert.match(serverSource, /app\.get\('\/api\/health'/);
  assert.match(serverSource, /app\.get\('\/api\/ready', runtimeBootstrap\.readinessEndpoint\)/);
  assert.match(bootstrapSource, /await postgres\.health\(\)/);
  assert.match(bootstrapSource, /status: result\.ready \? 'ready' : 'not_ready'/);
});

test('production does not mutate the development JSON datastore', () => {
  assert.match(jsonDbSource, /const IS_PRODUCTION = process\.env\.NODE_ENV === 'production'/);
  assert.match(jsonDbSource, /if \(IS_PRODUCTION\) return;/);
  assert.match(jsonDbSource, /if \(!IS_PRODUCTION\) \{/);
});

test('production container excludes Vite from runtime startup requirements', () => {
  assert.doesNotMatch(serverSource, /from 'vite'/);
  assert.match(serverSource, /await import\('vite'\)/);
});

test('production container is reproducible, non-root and lockfile driven', () => {
  assert.match(dockerfile, /FROM node:24-bookworm-slim AS build/);
  assert.match(dockerfile, /npm ci --no-audit --no-fund/);
  assert.match(dockerfile, /npm ci --omit=dev --no-audit --no-fund/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /ENV NODE_ENV=production/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.match(qualityWorkflow, /docker build --tag dealscout-ci \./);
});
