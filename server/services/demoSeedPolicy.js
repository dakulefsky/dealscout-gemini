function demoSeedAllowed() {
  return process.env.ALLOW_DEMO_SEED === 'true' && process.env.NODE_ENV !== 'production';
}

function isLegacyDemoAdmin(user) {
  return user?.id === 'usr-admin-1' || String(user?.email || '').toLowerCase() === 'admin@dealscout.local';
}

module.exports = { demoSeedAllowed, isLegacyDemoAdmin };
