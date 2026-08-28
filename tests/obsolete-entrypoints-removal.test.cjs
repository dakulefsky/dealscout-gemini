const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('obsolete secondary server entrypoint stays removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'server', 'index.js')), false);
});

test('legacy overwhelming Admin page stays removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'src', 'pages', 'Admin.jsx')), false);
});

test('package scripts use the hardened root server entrypoint', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node server.js');
  assert.equal(pkg.scripts.dev, 'node server.js');
});
