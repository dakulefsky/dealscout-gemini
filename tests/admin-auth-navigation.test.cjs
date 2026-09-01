const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('shared auth navigation targets the private admin sign-in route', () => {
  const authContext = read('src/lib/AuthContext.jsx');
  assert.match(authContext, /\/admin\/access\?returnTo=/);
  assert.doesNotMatch(authContext, /window\.location\.href = '\/login\?returnTo='/);
});
