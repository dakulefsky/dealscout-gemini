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
    RAINFOREST_DAILY_REQUEST_LIMIT: '16',
    RAINFOREST_MONTHLY_REQUEST_LIMIT: '500',
    GEMINI_MODEL: 'gemini-3.7-flash',
    GEMINI_DAILY_REQUEST_LIMIT: '200',
    GEMINI_MONTHLY_REQUEST_LIMIT: '5000',
    GCP_DB_SECRETS: 'DB_USER=dealscout-db-user:latest,DB_PASSWORD=dealscout-db-password:latest,DB_NAME=dealscout-db-name:latest',
    GCP_WEB_SECRETS: 'JWT_SECRET=dealscout-jwt:latest,RAINFOREST_API_KEY=dealscout-rainforest:latest,SMTP_PASS=dealscout-smtp-pass:latest',
    GCP_PUBLISHER_SECRETS: 'WAHA_API_KEY=dealscout-waha-key:latest',
    WAHA_BASE_URL: 'https://waha.example',
    WAHA_SESSION: 'dealscout-status',
    WAHA_TIMEOUT_MS: '18000',
    PUBLICATION_POLL_MS: '1800000',
    PUBLICATION_MIN_SPACING_SECONDS: '1800',
    PUBLICATION_QUEUE_BATCH: '2',
    PUBLICATION_CANDIDATE_LIMIT: '100',
    PUBLICATION_MAX_PER_CYCLE: '1',
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

test('gcloud env encoding preserves comma-separated CORS as one web value', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  const args = plan.commands[0].args;
  const encoded = args[args.indexOf('--set-env-vars') + 1];
  assert.match(encoded, /^\^\|\^/);
  assert.match(encoded, /CORS_ORIGINS=https:\/\/dealscout\.example,https:\/\/admin\.dealscout\.example/);
});

test('web release forwards provider and Gemini budget controls', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  const args = plan.commands[0].args;
  const encoded = args[args.indexOf('--set-env-vars') + 1];

  for (const expected of [
    'RAINFOREST_DAILY_REQUEST_LIMIT=16',
    'RAINFOREST_MONTHLY_REQUEST_LIMIT=500',
    'GEMINI_MODEL=gemini-3.7-flash',
    'GEMINI_DAILY_REQUEST_LIMIT=200',
    'GEMINI_MONTHLY_REQUEST_LIMIT=5000',
  ]) assert.match(encoded, new RegExp(expected.replaceAll('.', '\\.')));
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

test('publisher release forwards only publication worker config names the runtime consumes', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  const args = plan.commands[1].args;
  const encoded = args[args.indexOf('--set-env-vars') + 1];

  for (const expected of [
    'WAHA_TIMEOUT_MS=18000',
    'PUBLICATION_POLL_MS=1800000',
    'PUBLICATION_MIN_SPACING_SECONDS=1800',
    'PUBLICATION_QUEUE_BATCH=2',
    'PUBLICATION_CANDIDATE_LIMIT=100',
    'PUBLICATION_MAX_PER_CYCLE=1',
  ]) assert.match(encoded, new RegExp(expected));

  assert.doesNotMatch(encoded, /PUBLICATION_MIN_INTERVAL_MS|PUBLICATION_MIN_DISCOUNT|PUBLICATION_MIN_QUALITY/);
});

test('publisher gets DB and WAHA secrets but not web auth or provider secrets', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  const publisherArgs = plan.commands[1].args;
  const publisherSecrets = publisherArgs[publisherArgs.indexOf('--set-secrets') + 1];
  const publisherEnv = publisherArgs[publisherArgs.indexOf('--set-env-vars') + 1];

  assert.match(publisherSecrets, /DB_USER=dealscout-db-user:latest/);
  assert.match(publisherSecrets, /WAHA_API_KEY=dealscout-waha-key:latest/);
  assert.doesNotMatch(publisherSecrets, /JWT_SECRET|RAINFOREST_API_KEY|SMTP_PASS/);
  assert.doesNotMatch(publisherEnv, /PUBLIC_WEB_URL|CORS_ORIGINS|AMAZON_ASSOCIATE_TAG|DEAL_DATA_PROVIDER|RAINFOREST_DOMAIN|GEMINI_|RAINFOREST_.*REQUEST_LIMIT/);
});

test('release fails before gcloud when required role-specific secret references are missing', async () => {
  const { buildReleasePlan } = await loadModule();
  const missingDb = env();
  missingDb.GCP_DB_SECRETS = 'DB_USER=u:latest,DB_PASSWORD=p:latest';
  assert.throws(() => buildReleasePlan(missingDb), /GCP_DB_SECRETS must map DB_NAME/);

  const missingJwt = env();
  missingJwt.GCP_WEB_SECRETS = 'RAINFOREST_API_KEY=r:latest';
  assert.throws(() => buildReleasePlan(missingJwt), /GCP_WEB_SECRETS must map JWT_SECRET/);

  const missingWaha = env();
  missingWaha.GCP_PUBLISHER_SECRETS = 'OTHER=x:latest';
  assert.throws(() => buildReleasePlan(missingWaha), /GCP_PUBLISHER_SECRETS must map WAHA_API_KEY/);
});

test('selected provider secret requirements fail closed before deployment', async () => {
  const { buildReleasePlan } = await loadModule();

  const rainforest = env();
  rainforest.GCP_WEB_SECRETS = 'JWT_SECRET=j:latest';
  assert.throws(() => buildReleasePlan(rainforest), /RAINFOREST_API_KEY/);

  const paapi = env();
  paapi.DEAL_DATA_PROVIDER = 'amazon_paapi';
  paapi.GCP_WEB_SECRETS = 'JWT_SECRET=j:latest,AMAZON_PAAPI_ACCESS_KEY=a:latest';
  assert.throws(() => buildReleasePlan(paapi), /AMAZON_PAAPI_ACCESS_KEY, AMAZON_PAAPI_SECRET_KEY, AMAZON_PAAPI_PARTNER_TAG/);

  const auto = env();
  auto.DEAL_DATA_PROVIDER = 'auto';
  auto.GCP_WEB_SECRETS = 'JWT_SECRET=j:latest';
  assert.throws(() => buildReleasePlan(auto), /Rainforest or complete Amazon PA-API credentials/);
});

test('dry-run rendering contains secret references but never secret contents', async () => {
  const { buildReleasePlan, renderCommand } = await loadModule();
  const plan = buildReleasePlan(env());
  const rendered = plan.commands.map(renderCommand).join('\n');
  assert.match(rendered, /JWT_SECRET=dealscout-jwt:latest/);
  assert.match(rendered, /WAHA_API_KEY=dealscout-waha-key:latest/);
  assert.doesNotMatch(rendered, /actual-secret-value/);
});
