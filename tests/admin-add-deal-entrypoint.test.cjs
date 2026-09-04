const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

test('admin dashboard exposes a prominent protected Add deal entry point', () => {
  assert.match(app, /function AdminDashboard\(\)/);
  assert.match(app, /to="\/admin\/add-deal"/);
  assert.match(app, /aria-label="Add a deal"/);
  assert.match(app, /<span className="text-lg leading-none">\+<\/span> Add deal/);
  assert.match(app, /path="\/admin" element=\{<ProtectedRoute adminOnly><AdminDashboard \/><\/ProtectedRoute>\}/);
});
