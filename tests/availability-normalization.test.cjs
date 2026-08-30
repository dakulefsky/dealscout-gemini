const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { isUnavailableAvailability, normalizeAvailability } = require('../server/services/availabilityService');

test('common Amazon unavailable wording normalizes consistently', () => {
  for (const value of ['Currently unavailable', 'Temporarily out of stock', 'No featured offers available', 'Not available']) {
    assert.equal(isUnavailableAvailability(value), true);
    assert.equal(normalizeAvailability(value), 'Unavailable');
  }
  assert.equal(isUnavailableAvailability('In Stock'), false);
  assert.equal(normalizeAvailability('  In   Stock  '), 'In Stock');
});

test('both strict product adapters use shared availability normalization', () => {
  const rainforest = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'rainforestStrictAdapter.js'), 'utf8');
  const paapi = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'amazonPaapiStrictAdapter.js'), 'utf8');
  assert.equal(rainforest.includes('normalizeAvailability('), true);
  assert.equal(paapi.includes('normalizeAvailability('), true);
});
