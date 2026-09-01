const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');

async function loadModule() {
  return import(`${pathToFileURL(path.join(root, 'scripts', 'gcp-release.mjs')).href}?t=${Date.now()}`);
}

function env() {
  return {
    GCP_PROJECT_ID: 'project-123',
    GCP_REGION: 'us-central1',
    GCP_IMAGE: 'us-central1-docker.pkg.dev/project-123/dealscout/app:abc123',
    GCP_WEB_SERVICE: 'dealscout-web',
    GCP_PUBLISHER_POOL: 'dealscout-publisher',
    GCP_RUNTIME_SERVICE_ACCOUNT: 'dealscout-runtime@project-123.iam.gserviceaccount.com',
    CLOUD_SQL_CONNECTION_NAME: 'project-123:us-central1:dealscout-db',
    PUBLIC_WEB_URL: 'https://dealscout.example',
    CORS_ORIGINS: 'https://dealscout.example,https://admin.dealscout.example',
    AMAZON_ASSOCIATE_TAG: 'dealscout-20',
    DEAL_DATA_PROVIDER: 'rainforest',
    GCP_SHARED_SECRETS: 'JWT_SECRET=dealscout-jwt:latest,DB_USER=dealscout-db-user:latest,DB_PASSWORD=dealscout-db-password:latest,DB_NAME=dealscout-db-name:latest,RAINFOREST_API_KEY=dealscout-rainforest:latest',
    GCP_WEB_SECRETS: 'SMTP_PASS=dealscout-smtp-pass:latest',
    GCP_PUBLISHER_SECRETS: 'WAHA_API_KEY=dealscout-waha-key:latest',
    WAHA_BASE_URL: 'https://waha.example',
    WAHA_SESSION: 'dealscout-status',
    PUBLICATION_MIN_DISCOUNT: '20',
    PUBLICATION_MIN_QUALITY: '75',
  };
}

test('release plan deploys web as a Cloud Run service and publisher as one worker-pool instance', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  assert.equal(plan.commands.length, 2);

  const web = plan.commands[0].args;
  assert.deepEqual(web.slice(0, 3), ['run', 'deploy', 'dealscout-web']);
  assert.equal(web.includes('--allow-unauthenticated'), true);
  assert.equal(web.includes('--set-cloudsql-instances'), true);

  const publisher = plan.commands[1].args;
  assert.deepEqual(publisher.slice(0, 4), ['run', 'worker-pools', 'deploy', 'dealscout-publisher']);
  assert.equal(publisher[publisher.indexOf('--instances') + 1], '1');
  assert.equal(publisher[publisher.indexOf('--command') + 1], 'node');
  assert.equal(publisher[publisher.indexOf('--args') + 1], 'publication-worker.js');
});

test('gcloud env encoding preserves comma-separated CORS as one value', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  const args = plan.commands[0].args;
  const encoded = args[args.indexOf('--set-env-vars') + 1];
  assert.match(encoded, /^\^\|\^/);
  assert.match(encoded, /CORS_ORIGINS=https:\/\/dealscout\.example,https:\/\/admin\.dealscout\.example/);
});

test('publisher release is pinned to whatsapp_status WAHA continuous mode', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  const args = plan.commands[1].args;
  const encoded = args[args.indexOf('--set-env-vars') + 1];
  assert.match(encoded, /PUBLICATION_CHANNEL=whatsapp_status/);
  assert.match(encoded, /PUBLICATION_TRANSPORT=waha/);
  assert.match(encoded, /PUBLICATION_RUN_MODE=continuous/);
  assert.match(encoded, /WAHA_SESSION=dealscout-status/);
});

test('release fails before gcloud when required secret references are missing', async () => {
  const { buildReleasePlan } = await loadModule();
  const missingJwt = env();
  missingJwt.GCP_SHARED_SECRETS = 'DB_USER=u:latest,DB_PASSWORD=p:latest,DB_NAME=n:latest';
  assert.throws(() => buildReleasePlan(missingJwt), /GCP_SHARED_SECRETS must map JWT_SECRET/);

  const missingWaha = env();
  missingWaha.GCP_PUBLISHER_SECRETS = 'OTHER=x:latest';
  assert.throws(() => buildReleasePlan(missingWaha), /GCP_PUBLISHER_SECRETS must map WAHA_API_KEY/);
});

test('dry-run rendering contains secret references but never secret contents', async () => {
  const { buildReleasePlan, renderCommand } = await loadModule();
  const plan = buildReleasePlan(env());
  const rendered = plan.commands.map(renderCommand).join('\n');
  assert.match(rendered, /JWT_SECRET=dealscout-jwt:latest/);
  assert.match(rendered, /WAHA_API_KEY=dealscout-waha-key:latest/);
  assert.doesNotMatch(rendered, /actual-secret-value/);
});
