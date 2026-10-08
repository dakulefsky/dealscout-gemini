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
    GCP_ADMIN_SERVICE: 'dealscout',
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

test('release plan deploys public web, private admin, and one publisher worker', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  assert.equal(plan.commands.length, 3);

  const web = plan.commands[0].args;
  assert.deepEqual(web.slice(0, 3), ['run', 'deploy', 'dealscout-web']);
  assert.equal(web.includes('--allow-unauthenticated'), true);
  assert.equal(web.includes('--set-cloudsql-instances'), true);

  const admin = plan.commands[1].args;
  assert.deepEqual(admin.slice(0, 3), ['run', 'deploy', 'dealscout']);
  assert.equal(admin.includes('--allow-unauthenticated'), false);
  assert.equal(admin.includes('--set-env-vars'), false);
  assert.equal(admin.includes('--set-secrets'), false);

  const publisher = plan.commands[2].args;
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
  const args = plan.commands[2].args;
  const encoded = args[args.indexOf('--set-env-vars') + 1];
  assert.match(encoded, /PUBLICATION_CHANNEL=whatsapp_status/);
  assert.match(encoded, /PUBLICATION_TRANSPORT=waha/);
  assert.match(encoded, /PUBLICATION_RUN_MODE=continuous/);
  assert.match(encoded, /WAHA_SESSION=dealscout-status/);
});

test('publisher release forwards only publication worker config names the runtime consumes', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  const args = plan.commands[2].args;
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
  const publisherArgs = plan.commands[2].args;
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


test('release refuses to collapse public and private services into one Cloud Run service', async () => {
  const { buildReleasePlan } = await loadModule();
  const invalid = env();
  invalid.GCP_ADMIN_SERVICE = invalid.GCP_WEB_SERVICE;
  assert.throws(() => buildReleasePlan(invalid), /must differ/);
});

test('RDS release uses certificate verification and the same network on all consumers', async () => {
  const { buildReleasePlan } = await loadModule();
  const config = { ...env(), GCP_DATABASE_MODE: 'rds', GCP_RDS_DATABASE_SECRET: 'rds-url:1', GCP_RDS_CA_SECRET: 'rds-ca:1', GCP_DB_NETWORK: 'default', GCP_DB_SUBNET: 'default' };
  delete config.CLOUD_SQL_CONNECTION_NAME;
  delete config.GCP_DB_SECRETS;
  const plan = buildReleasePlan(config);
  for (const command of plan.commands) {
    const args = command.args;
    assert.ok(args.includes('--clear-cloudsql-instances'));
    assert.equal(args[args.indexOf('--vpc-egress') + 1], 'all-traffic');
    assert.equal(args[args.indexOf('--network') + 1], 'default');
    const envFlag = args.includes('--update-env-vars') ? '--update-env-vars' : '--set-env-vars';
    assert.match(args[args.indexOf(envFlag) + 1], /PGSSL=verify-full/);
    assert.match(args[args.indexOf(envFlag) + 1], /NODE_EXTRA_CA_CERTS=\/etc\/rds-ca\/aws-ca.pem/);
    const secretFlag = args.includes('--update-secrets') ? '--update-secrets' : '--set-secrets';
    assert.match(args[args.indexOf(secretFlag) + 1], /DATABASE_URL=rds-url:1/);
    assert.match(args[args.indexOf(secretFlag) + 1], /\/etc\/rds-ca\/aws-ca.pem=rds-ca:1/);
  }
  const admin = plan.commands[1].args;
  assert.equal(admin[admin.indexOf('--remove-env-vars') + 1], 'CLOUD_SQL_CONNECTION_NAME');
  assert.ok(!admin.includes('--allow-unauthenticated'));
  assert.ok(!admin.includes('--set-secrets'));
});

test('RDS configuration fails before deployment without secrets or network', async () => {
  const { buildReleasePlan } = await loadModule();
  const config = { ...env(), GCP_DATABASE_MODE: 'rds', GCP_RDS_DATABASE_SECRET: 'rds-url:latest', GCP_RDS_CA_SECRET: 'rds-ca:latest', GCP_DB_NETWORK: 'default', GCP_DB_SUBNET: 'default' };
  for (const key of ['GCP_RDS_DATABASE_SECRET', 'GCP_RDS_CA_SECRET', 'GCP_DB_NETWORK', 'GCP_DB_SUBNET']) {
    assert.throws(() => buildReleasePlan({ ...config, [key]: '' }), new RegExp(key));
  }
  assert.throws(() => buildReleasePlan({ ...config, GCP_DATABASE_MODE: 'typo' }), /GCP_DATABASE_MODE/);
});

test('CLI releases keep the same bounded replicas and scale-to-zero defaults as Actions', async () => {
  const { buildReleasePlan } = await loadModule();
  const plan = buildReleasePlan(env());
  for (const [index, max] of [[0, '3'], [1, '1']]) {
    const args = plan.commands[index].args;
    assert.equal(args[args.indexOf('--min-instances') + 1], '0');
    assert.equal(args[args.indexOf('--max-instances') + 1], max);
  }
  const custom = buildReleasePlan({ ...env(), GCP_WEB_MAX_INSTANCES: '2', GCP_ADMIN_MAX_INSTANCES: '2' });
  assert.equal(custom.commands[0].args[custom.commands[0].args.indexOf('--max-instances') + 1], '2');
  for (const value of ['0', '-1', '21', '1.5', 'many']) {
    assert.throws(() => buildReleasePlan({ ...env(), GCP_ADMIN_MAX_INSTANCES: value }), /integer from 1 to 20/);
  }
});

test('CLI admin release receives shared budgets and affiliate settings without replacing private settings', async () => {
  const { buildReleasePlan } = await loadModule();
  const args = buildReleasePlan(env()).commands[1].args;
  const shared = args[args.indexOf('--update-env-vars') + 1];
  assert.match(shared, /AMAZON_ASSOCIATE_TAG=dealscout-20/);
  assert.match(shared, /RAINFOREST_MONTHLY_REQUEST_LIMIT=500/);
  assert.match(shared, /DEAL_DATA_PROVIDER=rainforest/);
  assert.doesNotMatch(shared, /PUBLIC_SURFACE_ONLY/);
  assert.equal(args.includes('--set-env-vars'), false);
  assert.equal(args.includes('--allow-unauthenticated'), false);
});
