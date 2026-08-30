const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

test('home remains eager while secondary and admin routes are lazy loaded', () => {
  assert.match(app, /import Home from '@\/pages\/Home'/);
  assert.match(app, /const DealDetail = lazy\(\(\) => import\('@\/pages\/DealDetail'\)\)/);
  assert.match(app, /const AdminHome = lazy\(\(\) => import\('@\/pages\/AdminHome'\)\)/);
  assert.match(app, /const EditorialReview = lazy\(\(\) => import\('@\/pages\/EditorialReview'\)\)/);
  assert.doesNotMatch(app, /import AdminHome from '@\/pages\/AdminHome'/);
});

test('lazy route rendering has an accessible suspense fallback', () => {
  assert.match(app, /<Suspense fallback=\{<RouteFallback \/>\}>/);
  assert.match(app, /role="status"/);
  assert.match(app, /aria-live="polite"/);
});
