const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Deal Advisor only promises answers from saved DealScout context', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/AiDealAssistant.jsx'), 'utf8');
  assert.match(source, /limited to DealScout's saved deal facts and editorial context/);
  assert.match(source, /rather than guess/);
  assert.doesNotMatch(source, /customer feedback/);
  assert.doesNotMatch(source, /competitor comparisons/);
  assert.doesNotMatch(source, /most common complaints/);
});

test('suggested questions are answerable from the stored deal record', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/AiDealAssistant.jsx'), 'utf8');
  assert.match(source, /How strong is this discount based on the listed prices/);
  assert.match(source, /What important information is missing from this deal record/);
});
