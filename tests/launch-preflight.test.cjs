const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');

async function moduleUnderTest() {
  return import(`${pathToFileURL(path.join(root, 'scripts', 'launch-preflight.mjs')).href}?t=${Date.now()}`);
}

function productionEnv() {
  return {
    PUBLIC_WEB_URL: 'https://dealscout.example',
    CORS_ORIGINS: 'https://dealscout.example,https://admin.dealscout.example',
    JWT_SECRET: 'x'.repeat(40),
    CLOUD_SQL_CONNECTION_NAME: 'project:region:instance',
    DB_USER: 'dealscout',
    DB_PASSWORD: 'secret',
    DB_NAME: 'dealscout',
    AMAZON_ASSOCIATE_TAG: 'dealscout-20',
    DEAL_DATA_PROVIDER: 'rainforest',
    RAINFOREST_API_KEY: 'provider-key',
    SMTP_HOST: 'smtp.example',
    SMTP_USER: 'mailer',
    SMTP_PASS: 'secret',
    MAIL_FROM: 'deals@dealscout.example',
    EXPO_PUBLIC_API_URL: 'https://dealscout.example',
    PUBLICATION_CHANNEL: 'whatsapp_status',
    PUBLICATION_TRANSPORT: 'waha',
    WAHA_BASE_URL: 'https://waha.internal.example',
    WAHA_API_KEY: 'w'.repeat(20),
    WAHA_SESSION: 'dealscout-status',
  };
}

function productionAppConfig() {
  return {
    expo: {
      icon: './assets/icon.png',
      ios: { bundleIdentifier: 'com.dealscout.app' },
      android: {
        package: 'com.dealscout.app',
        adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png' },
      },
      extra: { eas: { projectId: '00000000-0000-0000-0000-000000000000' } },
    },
  };
}

test('launch preflight can prove all three product surfaces ready without exposing secret values', async () => {
  const { evaluateLaunch } = await moduleUnderTest();
  const result = evaluateLaunch({ env: productionEnv(), appConfig: productionAppConfig(), fileExists: () => true });
  assert.equal(result.ready, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(new Set(result.checks.map((item) => item.surface)), new Set(['website', 'shared', 'mobile', 'whatsapp_status']));
  assert.equal(JSON.stringify(result).includes('provider-key'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('launch preflight fails closed on missing production infrastructure and mobile release assets', async () => {
  const { evaluateLaunch } = await moduleUnderTest();
  const result = evaluateLaunch({
    env: { PUBLIC_WEB_URL: 'http://localhost:3000', PUBLICATION_TRANSPORT: 'webhook' },
    appConfig: { expo: { ios: {}, android: {} } },
    fileExists: () => false,
  });
  assert.equal(result.ready, false);
  const blockerIds = new Set(result.blockers.map((item) => item.id));
  for (const id of ['web-url', 'jwt', 'database', 'provider', 'mobile-api', 'eas-project', 'app-icon', 'adaptive-icon', 'status-transport', 'waha-session']) {
    assert.equal(blockerIds.has(id), true, `expected blocker ${id}`);
  }
});

test('SMTP absence is visible but does not make the three-surface runtime itself fail preflight', async () => {
  const { evaluateLaunch } = await moduleUnderTest();
  const env = productionEnv();
  delete env.SMTP_HOST;
  const result = evaluateLaunch({ env, appConfig: productionAppConfig(), fileExists: () => true });
  assert.equal(result.ready, true);
  assert.deepEqual(result.warnings.map((item) => item.id), ['smtp']);
});
