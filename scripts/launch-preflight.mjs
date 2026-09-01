import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function value(env, key) {
  return String(env?.[key] || '').trim();
}

function httpsOrigin(input) {
  if (!input) return false;
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && url.origin === input.replace(/\/$/, '');
  } catch {
    return false;
  }
}

function completeCloudSql(env) {
  return ['CLOUD_SQL_CONNECTION_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].every((key) => value(env, key));
}

function providerReady(env) {
  const selected = value(env, 'DEAL_DATA_PROVIDER') || 'auto';
  const rainforest = Boolean(value(env, 'RAINFOREST_API_KEY'));
  const paapi = ['AMAZON_PAAPI_ACCESS_KEY', 'AMAZON_PAAPI_SECRET_KEY', 'AMAZON_PAAPI_PARTNER_TAG'].every((key) => value(env, key));
  if (selected === 'rainforest') return rainforest;
  if (selected === 'amazon_paapi') return paapi;
  return rainforest || paapi;
}

function hasMail(env) {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].every((key) => value(env, key));
}

function check(id, surface, ok, message, severity = 'blocker') {
  return { id, surface, ok: Boolean(ok), message, severity };
}

export function evaluateLaunch({ env = {}, appConfig = {}, fileExists = () => false } = {}) {
  const expo = appConfig?.expo || {};
  const corsOrigins = value(env, 'CORS_ORIGINS').split(',').map((item) => item.trim()).filter(Boolean);
  const dbReady = Boolean(value(env, 'DATABASE_URL')) || completeCloudSql(env);
  const easProjectId = value(env, 'EAS_PROJECT_ID') || String(expo.extra?.eas?.projectId || '').trim();
  const privacyUrl = value(env, 'EXPO_PUBLIC_PRIVACY_URL') || String(expo.extra?.privacyUrl || '').trim();
  const supportUrl = value(env, 'EXPO_PUBLIC_SUPPORT_URL') || String(expo.extra?.supportUrl || '').trim();
  const iconPath = expo.icon ? path.resolve(root, 'apps/mobile', expo.icon) : '';
  const adaptivePath = expo.android?.adaptiveIcon?.foregroundImage
    ? path.resolve(root, 'apps/mobile', expo.android.adaptiveIcon.foregroundImage)
    : '';

  const checks = [
    check('web-url', 'website', httpsOrigin(value(env, 'PUBLIC_WEB_URL')), 'PUBLIC_WEB_URL is a canonical HTTPS origin.'),
    check('cors', 'website', corsOrigins.length > 0 && corsOrigins.every(httpsOrigin), 'CORS_ORIGINS contains only explicit HTTPS browser origins.'),
    check('jwt', 'shared', value(env, 'JWT_SECRET').length >= 32, 'JWT_SECRET is configured with at least 32 characters.'),
    check('database', 'shared', dbReady, 'Shared production PostgreSQL/Cloud SQL configuration is complete.'),
    check('affiliate', 'shared', Boolean(value(env, 'AMAZON_ASSOCIATE_TAG')), 'AMAZON_ASSOCIATE_TAG is configured.'),
    check('provider', 'shared', providerReady(env), 'At least one selected verified deal-data provider is configured.'),
    check('smtp', 'website', hasMail(env), 'SMTP is configured for admin recovery and verification mail.', 'warning'),

    check('mobile-api', 'mobile', httpsOrigin(value(env, 'EXPO_PUBLIC_API_URL')), 'EXPO_PUBLIC_API_URL points to the production HTTPS API origin.'),
    check('ios-id', 'mobile', Boolean(expo.ios?.bundleIdentifier), 'iOS bundle identifier is configured.'),
    check('android-id', 'mobile', Boolean(expo.android?.package), 'Android application package is configured.'),
    check('eas-project', 'mobile', Boolean(easProjectId), 'Expo/EAS project is linked by EAS_PROJECT_ID or app config.'),
    check('privacy-url', 'mobile', httpsOrigin(privacyUrl), 'Mobile privacy-policy URL is configured as an HTTPS origin.'),
    check('support-url', 'mobile', httpsOrigin(supportUrl), 'Mobile support URL is configured as an HTTPS origin.'),
    check('app-icon', 'mobile', Boolean(iconPath) && fileExists(iconPath), 'Final app icon exists and is wired into Expo config.'),
    check('adaptive-icon', 'mobile', Boolean(adaptivePath) && fileExists(adaptivePath), 'Android adaptive foreground icon exists and is wired into Expo config.'),

    check('status-channel', 'whatsapp_status', value(env, 'PUBLICATION_CHANNEL') === 'whatsapp_status', 'Publication worker is explicitly configured for whatsapp_status.'),
    check('status-transport', 'whatsapp_status', value(env, 'PUBLICATION_TRANSPORT') === 'waha', 'WhatsApp Status production transport is WAHA.'),
    check('waha-url', 'whatsapp_status', httpsOrigin(value(env, 'WAHA_BASE_URL')), 'WAHA_BASE_URL is an HTTPS endpoint.'),
    check('waha-key', 'whatsapp_status', value(env, 'WAHA_API_KEY').length >= 16, 'WAHA_API_KEY is configured with at least 16 characters.'),
    check('waha-session', 'whatsapp_status', Boolean(value(env, 'WAHA_SESSION')), 'WAHA_SESSION names the intended paired Status account.'),
  ];

  const blockers = checks.filter((item) => !item.ok && item.severity === 'blocker');
  const warnings = checks.filter((item) => !item.ok && item.severity === 'warning');
  return { ready: blockers.length === 0, checks, blockers, warnings };
}

export function loadMobileConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, 'apps/mobile/app.json'), 'utf8'));
}

function render(result) {
  const bySurface = new Map();
  for (const item of result.checks) {
    if (!bySurface.has(item.surface)) bySurface.set(item.surface, []);
    bySurface.get(item.surface).push(item);
  }

  console.log('DealScout launch preflight');
  for (const [surface, checks] of bySurface) {
    console.log(`\n${surface}`);
    for (const item of checks) {
      const mark = item.ok ? 'PASS' : item.severity === 'warning' ? 'WARN' : 'BLOCK';
      console.log(`  ${mark.padEnd(5)} ${item.message}`);
    }
  }
  console.log(`\n${result.ready ? 'READY' : 'NOT READY'}: ${result.blockers.length} blocker(s), ${result.warnings.length} warning(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = evaluateLaunch({
    env: process.env,
    appConfig: loadMobileConfig(),
    fileExists: fs.existsSync,
  });
  render(result);
  process.exitCode = result.ready ? 0 : 1;
}
