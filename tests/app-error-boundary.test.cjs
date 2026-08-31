const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
const boundary = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AppErrorBoundary.jsx'), 'utf8');

test('root app tree is protected by an error boundary', () => {
  assert.match(app, /import AppErrorBoundary/);
  assert.match(app, /<AppErrorBoundary>[\s\S]*<AuthProvider>/);
  assert.match(app, /<\/AuthProvider>[\s\S]*<\/AppErrorBoundary>/);
});

test('boundary catches render errors and exposes an accessible recovery action', () => {
  assert.match(boundary, /static getDerivedStateFromError/);
  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /role="alert"/);
  assert.match(boundary, /Reload DealScout/);
  assert.match(boundary, /window\.location\.reload\(\)/);
});
