const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'bookmarks.js'), 'utf8');

test('bookmark deal responses exclude legacy enrichment and ratings', () => {
  const serializer = source.match(/function rowToPublicDeal\(r\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(serializer);
  for (const forbidden of ['rating:', 'ratingsTotal', 'shortBio', 'fullSummary', 'pros:', 'cons:', 'reviews:', 'rawSourceData', 'sourceProvider']) {
    assert.equal(serializer.includes(forbidden), false, `serializer must not expose ${forbidden}`);
  }
  assert.match(serializer, /qualityScore/);
  assert.match(serializer, /priceCheckAt/);
});

test('price alert response does not echo stored email or full alert record', () => {
  const response = source.match(/res\.json\(\{\n      success: true,[\s\S]*?\n    \}\);/)?.[0] || '';
  assert.ok(response);
  assert.equal(response.includes('email:'), false);
  assert.match(response, /alert: \{ id: alert\.id, dealId: alert\.dealId, targetPrice: alert\.targetPrice, status: alert\.status \}/);
});
