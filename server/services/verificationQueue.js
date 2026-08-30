function verificationAgeKey(deal) {
  const checked = Number(deal?.price_check_at ?? deal?.priceCheckAt ?? 0);
  if (!Number.isFinite(checked) || checked <= 0) return 0;
  return checked;
}

function attemptAgeKey(deal) {
  const attempted = Number(deal?.last_verify_attempt_at ?? deal?.lastVerifyAttemptAt ?? 0);
  if (!Number.isFinite(attempted) || attempted <= 0) return 0;
  return attempted;
}

function oldestCheckedFirst(deals = [], limit = 10) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  return [...deals]
    .sort((a, b) => {
      const checkedDiff = verificationAgeKey(a) - verificationAgeKey(b);
      if (checkedDiff !== 0) return checkedDiff;
      const attemptDiff = attemptAgeKey(a) - attemptAgeKey(b);
      if (attemptDiff !== 0) return attemptDiff;
      return Number(a?.created_at || 0) - Number(b?.created_at || 0);
    })
    .slice(0, safeLimit);
}

module.exports = { oldestCheckedFirst, verificationAgeKey, attemptAgeKey };
