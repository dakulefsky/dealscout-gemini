const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { isAllowedAmazonUrl } = require('../server/services/siteStripeService');

const functionsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'functions.js'), 'utf8');
const siteStripe = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'siteStripeService.js'), 'utf8');

test('SiteStripe resolution only allows Amazon-owned hosts', () => {
  assert.equal(isAllowedAmazonUrl('https://amzn.to/abc123'), true);
  assert.equal(isAllowedAmazonUrl('https://a.co/abc123'), true);
  assert.equal(isAllowedAmazonUrl('https://www.amazon.com/dp/B08PZHYWJS'), true);
  assert.equal(isAllowedAmazonUrl('https://amazon.co.uk/dp/B08PZHYWJS'), true);
  assert.equal(isAllowedAmazonUrl('http://127.0.0.1:3000/internal'), false);
  assert.equal(isAllowedAmazonUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.equal(isAllowedAmazonUrl('https://amazon.com.evil.example/dp/B08PZHYWJS'), false);
  assert.equal(isAllowedAmazonUrl('https://example.com/redirect'), false);
});

test('SiteStripe redirect traversal revalidates every hop', () => {
  assert.match(siteStripe, /if \(!isAllowedAmazonUrl\(currentUrl\)\)/);
  assert.match(siteStripe, /if \(!isAllowedAmazonUrl\(resolvedLocation\)\)/);
  assert.match(siteStripe, /if \(!isAllowedAmazonUrl\(nextUrl\)\)/);
});

test('SiteStripe parser endpoint is admin-only', () => {
  assert.match(functionsRoute, /router\.post\('\/parse-sitestripe', requireAdmin, async/);
});