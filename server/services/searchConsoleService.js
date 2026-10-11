const settings = require('./siteRuntimeSettingsService');
let cached = null;
let expiresAt = 0;
async function token() {
  if (cached !== null && Date.now() < expiresAt) return cached;
  cached = (await settings.get('google_site_verification')).value;
  expiresAt = Date.now() + 60000;
  return cached;
}
async function save(value) {
  const result = await settings.set('google_site_verification', value);
  cached = result.value;
  expiresAt = Date.now() + 60000;
  return result;
}
module.exports = { token, save };
