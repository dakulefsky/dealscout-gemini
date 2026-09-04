const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'src/components/admin/AddDealCard.jsx'), 'utf8');
const functionsRoute = fs.readFileSync(path.join(root, 'server/routes/functions.js'), 'utf8');

test('admin has a protected manual deal URL import surface', () => {
  assert.match(app, /path="\/admin\/add-deal"/);
  assert.match(app, /<ProtectedRoute adminOnly><AddDeal \/><\/ProtectedRoute>/);
  assert.match(card, /Paste an Amazon product URL, amzn\.to link, SiteStripe link, or ASIN/);
  assert.match(card, /functions\.siteStripeImport\(value, false\)/);
});

test('manual deal import stays behind live verification and review', () => {
  assert.match(functionsRoute, /router\.post\('\/sitestripe-import', requireAdmin/);
  assert.match(functionsRoute, /requireVerifiedProduct\(await fetchProductByAsin/);
  assert.match(functionsRoute, /PENDING_REVIEW/);
  assert.match(card, /Nothing is published from the pasted URL alone/);
});
