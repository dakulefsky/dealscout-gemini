function rediscoveryLifecycleChanges(existing, publicationStatus) {
  // A manual rejection wins over the expired flag, which may still be set
  // when an already-expired listing is rejected in the admin dashboard.
  if (existing?.status === 'REJECTED') return {};
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
