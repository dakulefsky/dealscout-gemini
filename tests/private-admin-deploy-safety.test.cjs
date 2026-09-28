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

test('main branch deploys both services automatically and still runs release smoke', () => {
  assert.match(workflow, /on:\s*push:\s*branches: \[main\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /if: \$\{\{ github\.event_name == 'push' \|\| inputs\.run_smoke \}\}/);
  assert.match(workflow, /Verify public and private image parity/);
});
