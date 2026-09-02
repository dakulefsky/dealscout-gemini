function rediscoveryLifecycleChanges(existing, publicationStatus) {
  const wasExpired = existing?.is_expired === 1 || existing?.is_expired === true || existing?.status === 'EXPIRED';
  if (wasExpired) {
    return {
      is_expired: 0,
      expired_at: null,
      status: publicationStatus || 'PENDING_REVIEW',
    };
  }

  // A human rejection is sticky. Rediscovery can refresh its price/source data,
  // but must not silently put the same ASIN back into the public feed or queue.
  if (existing?.status === 'REJECTED') return {};

  if (existing?.status !== 'APPROVED' && publicationStatus === 'APPROVED') {
    return { status: 'APPROVED' };
  }

  return {};
}

module.exports = { rediscoveryLifecycleChanges };
