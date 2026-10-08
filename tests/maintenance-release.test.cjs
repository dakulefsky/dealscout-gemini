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

test('first rollout verifies one execution, updates do not execute, and denied inspection cannot become a deployment', () => {
  const os = require('node:os');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dealscout-job-cli-'));
  const output = path.join(dir, 'args.json');
  const fake = path.join(dir, 'gcloud');
  fs.writeFileSync(fake, `#!${process.execPath}\nconst fs=require('node:fs'); const args=process.argv.slice(2); if(args.includes('list')) { if(process.env.MOCK_JOB==='denied'){console.error('PERMISSION_DENIED');process.exit(1);} if(process.env.MOCK_JOB==='existing')console.log('dealscout-maintenance'); } else {fs.writeFileSync(process.env.MOCK_OUTPUT,JSON.stringify(args));}\n`);
  fs.chmodSync(fake, 0o755);
  try {
    for (const mode of ['missing', 'existing', 'denied']) {
      fs.rmSync(output, { force: true });
      const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/maintenance-release.mjs')], {
        env: { ...process.env, ...config, PATH: `${dir}:${process.env.PATH}`, MOCK_JOB: mode, MOCK_OUTPUT: output }, encoding: 'utf8',
      });
      if (mode === 'denied') {
        assert.notEqual(result.status, 0);
        assert.equal(fs.existsSync(output), false);
      } else {
        assert.equal(result.status, 0, result.stderr);
        const args = JSON.parse(fs.readFileSync(output, 'utf8'));
        assert.equal(args.includes('--execute-now'), mode === 'missing');
        assert.equal(args.includes('--wait'), mode === 'missing');
      }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
