const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('password reset emails target the private admin reset route', () => {
  const mail = read('server/services/mailService.js');
  assert.match(mail, /\/admin\/reset-password\?token=/);
  assert.doesNotMatch(mail, /\$\{baseUrl\}\/reset-password\?token=/);
});

test('legacy reset links preserve their token while moving to the admin route', () => {
  const app = read('src/App.jsx');
  assert.match(app, /function LegacyResetRedirect\(\)/);
  assert.match(app, /admin\/reset-password\$\{location\.search\}/);
  assert.match(app, /path="\/reset-password" element=\{<LegacyResetRedirect \/>\}/);
});

test('admin reset UI matches backend password rules and returns to admin sign in', () => {
  const page = read('src/pages/ResetPassword.jsx');
  assert.match(page, /password\.length < 8/);
  assert.match(page, /At least 8 characters/);
  assert.match(page, /to="\/admin\/access"/);
  assert.doesNotMatch(page, /to="\/login"/);
});
