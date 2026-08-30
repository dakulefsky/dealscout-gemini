const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('cron refresh paths apply verified source metadata changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'cronService.js'), 'utf8');
  assert.equal(source.includes("require('./verifiedDealRefresh')"), true);
  assert.equal(source.includes('...verifiedSourceChanges(deal, liveInfo)'), true);
  assert.equal(source.includes('...verifiedSourceChanges(existing, item)'), true);
});
