const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['Privacy.jsx', 'Support.jsx', 'Disclosure.jsx']) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', file), 'utf8');
  assert.doesNotMatch(source, /rounded-3xl|shadow-sm|shadow-xs/, `${file} should use the flat editorial layout`);
}

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
const boundary = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AppErrorBoundary.jsx'), 'utf8');
assert.doesNotMatch(app, /max-w-md mx-auto rounded-2xl/);
assert.doesNotMatch(boundary, /rounded-3xl/);
