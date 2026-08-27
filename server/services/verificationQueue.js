function verificationAgeKey(deal) {
  const attempted = Number(deal?.last_verify_attempt_at ?? deal?.lastVerifyAttemptAt ?? 0);
  const checked = Number(deal?.price_check_at ?? deal?.priceCheckAt ?? 0);
  const value = attempted > 0 ? attempted : checked;
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function oldestCheckedFirst(deals = [], limit = 10) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  return [...deals]
    .sort((a, b) => {
      const ageDiff = verificationAgeKey(a) - verificationAgeKey(b);
      if (ageDiff !== 0) return ageDiff;
      return Number(a?.created_at || 0) - Number(b?.created_at || 0);
    })
    .slice(0, safeLimit);
}

module.exports = { oldestCheckedFirst, verificationAgeKey };
