const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { extractAsin, isAmazonUrl, formatAffiliateUrl } = require('../server/services/amazonUrlService');

const functionsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'functions.js'), 'utf8');
const siteStripe = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'siteStripeService.js'), 'utf8');

test('extractAsin handles raw ASINs and common Amazon links', () => {
  assert.equal(extractAsin('B08PZHYWJS'), 'B08PZHYWJS');
  assert.equal(extractAsin('https://www.amazon.com/dp/B08PZHYWJS?tag=test-20'), 'B08PZHYWJS');
  assert.equal(extractAsin('https://www.amazon.com/gp/product/B08PZHYWJS'), 'B08PZHYWJS');
  assert.equal(extractAsin('not-an-asin'), null);
});

test('formatAffiliateUrl applies an explicit tag and does not invent one', () => {
  assert.match(formatAffiliateUrl('https://www.amazon.com/dp/B08PZHYWJS', 'owner-20'), /tag=owner-20/);
  const previous = process.env.AMAZON_ASSOCIATE_TAG;
  delete process.env.AMAZON_ASSOCIATE_TAG;
  try {
    assert.equal(formatAffiliateUrl('https://www.amazon.com/dp/B08PZHYWJS'), 'https://www.amazon.com/dp/B08PZHYWJS');
  } finally {
    if (previous === undefined) delete process.env.AMAZON_ASSOCIATE_TAG;
    else process.env.AMAZON_ASSOCIATE_TAG = previous;
  }
});

test('affiliate URL formatting rejects non-Amazon and lookalike hosts', () => {
  assert.equal(isAmazonUrl('https://amazon.co.uk/dp/B08PZHYWJS'), true);
  assert.equal(isAmazonUrl('https://a.co/abc123'), true);
  assert.equal(isAmazonUrl('https://amazon.com.evil.example/dp/B08PZHYWJS'), false);
  assert.equal(isAmazonUrl('https://example.com/dp/B08PZHYWJS'), false);
  assert.throws(() => formatAffiliateUrl('https://example.com/dp/B08PZHYWJS', 'owner-20'), /Amazon-owned host/);
  assert.throws(() => formatAffiliateUrl('http://127.0.0.1/dp/B08PZHYWJS', 'owner-20'), /Amazon-owned host/);
});

test('active function and SiteStripe routes do not import the legacy Rainforest service', () => {
  assert.doesNotMatch(functionsRoute, /services\/rainforestService/);
  assert.doesNotMatch(siteStripe, /rainforestService/);
  assert.doesNotMatch(siteStripe, /generateAuthenticReviewsForProduct/);
  assert.match(functionsRoute, /amazonUrlService/);
  assert.match(siteStripe, /amazonUrlService/);
});
