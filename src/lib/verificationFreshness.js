export function verificationFreshness(timestamp, nowMs = Date.now()) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return { label: 'Verification time unavailable', ageSeconds: null, stale: true };

  const ageSeconds = Math.max(0, Math.floor((nowMs - seconds * 1000) / 1000));
  if (ageSeconds < 60) return { label: 'Price checked just now', ageSeconds, stale: false };
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return { label: `Price checked ${minutes} min ago`, ageSeconds, stale: false };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `Price checked ${hours} hr${hours === 1 ? '' : 's'} ago`, ageSeconds, stale: hours >= 12 };
  const days = Math.floor(hours / 24);
  return { label: `Price checked ${days} day${days === 1 ? '' : 's'} ago`, ageSeconds, stale: true };
}
