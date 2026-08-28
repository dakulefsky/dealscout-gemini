const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('legacy synthetic provider modules are physically removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'server', 'services', 'rainforestService.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'server', 'services', 'amazonScraperService.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'server', 'rainforest.js')), false);
});

test('Rainforest live diagnostic uses current strict routing and neutral affiliate helper', () => {
  const script = fs.readFileSync(path.join(root, 'scripts', 'test-rainforest-live.js'), 'utf8');
  assert.match(script, /providerRouter/);
  assert.match(script, /amazonUrlService/);
  assert.doesNotMatch(script, /rainforestService/);
  assert.doesNotMatch(script, /isQuotaExhausted/);
});
