function rediscoveryLifecycleChanges(existing, publicationStatus) {
  const wasExpired = existing?.is_expired === 1 || existing?.is_expired === true || existing?.status === 'EXPIRED';
  if (wasExpired) {
    return {
      is_expired: 0,
      expired_at: null,
      status: publicationStatus || 'PENDING_REVIEW',
    };
  }

  if (existing?.status !== 'APPROVED' && publicationStatus === 'APPROVED') {
    return { status: 'APPROVED' };
  }

  return {};
}

module.exports = { rediscoveryLifecycleChanges };
