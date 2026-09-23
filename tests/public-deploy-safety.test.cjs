const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'deploy-web.yml'), 'utf8');

test('public deployment always enables shopper-only mode', () => {
  assert.match(workflow, /PUBLIC_SURFACE_ONLY=true/);
  assert.match(workflow, /Public shopper and private admin must use different Cloud Run services/);
  assert.match(workflow, /Deploy private admin revision/);
});
