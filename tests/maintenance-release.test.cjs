const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const config = {
  GCP_DATABASE_MODE: 'rds', GCP_PROJECT_ID: 'test-project', GCP_REGION: 'us-central1', GCP_IMAGE: 'gcr.io/test/app:immutable',
  GCP_RUNTIME_SERVICE_ACCOUNT: 'runtime@test.iam.gserviceaccount.com',
  GCP_RDS_DATABASE_SECRET: 'rds-url:1', GCP_RDS_CA_SECRET: 'rds-ca:1', GCP_DB_NETWORK: 'default', GCP_DB_SUBNET: 'default',
  AMAZON_ASSOCIATE_TAG: 'owner-20', DEAL_DATA_PROVIDER: 'rainforest',
  GCP_WEB_SECRETS: 'JWT_SECRET=jwt:1,RAINFOREST_API_KEY=rainforest:1,SMTP_PASS=mail:1', RAINFOREST_MONTHLY_REQUEST_LIMIT: '500',
};
test('maintenance job uses verified RDS TLS/NAT, one bounded task and no web JWT or mail credentials', async () => {
  const { maintenanceRelease } = await import('../scripts/maintenance-release.mjs');
  const args = maintenanceRelease(config);
  const value = (flag) => args[args.indexOf(flag) + 1];
  assert.equal(value('--tasks'), '1');
  assert.equal(value('--max-retries'), '0');
  assert.equal(value('--task-timeout'), '600s');
  assert.equal(value('--vpc-egress'), 'all-traffic');
  assert.equal(value('--set-cloudsql-instances'), '');
  assert.match(value('--set-env-vars'), /PGSSL=verify-full/);
  assert.match(value('--set-env-vars'), /RAINFOREST_MONTHLY_REQUEST_LIMIT=500/);
  assert.match(value('--set-secrets'), /DATABASE_URL=rds-url:1/);
  assert.match(value('--set-secrets'), /RAINFOREST_API_KEY=rainforest:1/);
  assert.doesNotMatch(value('--set-secrets'), /JWT_SECRET|SMTP_PASS/);
  assert.equal(value('--args'), 'maintenance-worker.js');
});
test('missing provider configuration fails before deployment, without creating an idle broken job', async () => {
  const { maintenanceRelease } = await import('../scripts/maintenance-release.mjs');
  assert.throws(() => maintenanceRelease({ ...config, GCP_WEB_SECRETS: 'JWT_SECRET=jwt:1' }), /RAINFOREST_API_KEY/);
  assert.throws(() => maintenanceRelease({ ...config, DEAL_DATA_PROVIDER: 'typo' }), /DEAL_DATA_PROVIDER/);
});
test('scheduled workflow reuses the identity and executes a job without a build or a public maintenance endpoint', () => {
  const workflow = fs.readFileSync(require.resolve('../.github/workflows/maintenance.yml'), 'utf8');
  assert.match(workflow, /43 \*\/6 \* \* \*/);
  assert.match(workflow, /jobs execute dealscout-maintenance/);
  assert.doesNotMatch(workflow, /builds submit|allow-unauthenticated|curl/);
});
