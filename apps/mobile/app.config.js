const base = require('./app.json').expo;

function optional(value) {
  const result = String(value || '').trim();
  return result || undefined;
}

module.exports = () => {
  const projectId = optional(process.env.EAS_PROJECT_ID);
  const owner = optional(process.env.EXPO_OWNER);
  const privacyUrl = optional(process.env.EXPO_PUBLIC_PRIVACY_URL);
  const supportUrl = optional(process.env.EXPO_PUBLIC_SUPPORT_URL);

  return {
    ...base,
    ...(owner ? { owner } : {}),
    extra: {
      ...(base.extra || {}),
      ...(projectId ? { eas: { ...(base.extra?.eas || {}), projectId } } : {}),
      ...(privacyUrl ? { privacyUrl } : {}),
      ...(supportUrl ? { supportUrl } : {}),
    },
  };
};
