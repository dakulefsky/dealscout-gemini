const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const quality = fs.readFileSync(path.join(root, '.github', 'workflows', 'quality.yml'), 'utf8');
const rainforest = fs.readFileSync(path.join(root, '.github', 'workflows', 'rainforest-live.yml'), 'utf8');

test('npm is the single package-manager authority', () => {
  assert.match(pkg.packageManager, /^npm@/);
  assert.equal(pkg.engines.node, '>=24 <25');
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, pkg.name);
  assert.equal(fs.existsSync(path.join(root, 'bun.lock')), false);
});

test('CI and live diagnostics install exactly from the committed npm lock', () => {
  assert.match(quality, /npm ci --no-audit --no-fund/);
  assert.match(quality, /cache-dependency-path: package-lock\.json/);
  assert.match(rainforest, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(rainforest, /cache-dependency-path: package-lock\.json/);
  assert.doesNotMatch(quality, /npm install/);
  assert.doesNotMatch(rainforest, /npm install/);
});

test('removed generated UI packages stay out of the dependency manifest and lock root', () => {
  const removed = ['@tanstack/react-query', 'date-fns', 'react-day-picker', 'recharts'];
  const lockedRootDeps = lock.packages?.['']?.dependencies || {};
  for (const name of removed) {
    assert.equal(pkg.dependencies?.[name], undefined, `${name} should not be a direct dependency`);
    assert.equal(lockedRootDeps[name], undefined, `${name} should not be locked at the root`);
  }
});
