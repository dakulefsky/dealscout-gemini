const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'deploy-web.yml'), 'utf8');

test('production workflow advances private admin without changing its access configuration', () => {
  assert.match(workflow, /Deploy private admin revision/);
  assert.match(workflow, /gcloud run deploy "\$GCP_ADMIN_SERVICE"/);
  const privateStep = workflow.split('- name: Deploy private admin revision')[1].split('- name: Verify deployed revision')[0];
  assert.doesNotMatch(privateStep, /allow-unauthenticated|set-env-vars|set-secrets|no-invoker-iam-check/);
});
