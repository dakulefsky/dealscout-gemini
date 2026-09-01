function manualExpireChanges(deal, reason = 'Manually marked as expired by Admin', nowSeconds = Math.floor(Date.now() / 1000)) {
  const expiredAt = Number(nowSeconds);
  const suffix = `[EXPIRED: ${new Date(expiredAt * 1000).toISOString()} - ${reason}]`;
  return {
    status: 'EXPIRED',
    is_expired: 1,
    expired_at: expiredAt,
    raw_source_data: `${deal?.raw_source_data || ''} | ${suffix}`,
  };
}

function manualRestoreChanges() {
  return {
    status: 'APPROVED',
    is_expired: 0,
    expired_at: null,
  };
}

module.exports = { manualExpireChanges, manualRestoreChanges };
