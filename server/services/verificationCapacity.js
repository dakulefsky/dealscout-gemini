const DEFAULT_PUBLIC_FRESHNESS_HOURS = 24;
const DEFAULT_VERIFICATION_INTERVAL_HOURS = 12;

function verificationBatchSize(activeCount, {
  intervalHours = DEFAULT_VERIFICATION_INTERVAL_HOURS,
  targetHours = DEFAULT_PUBLIC_FRESHNESS_HOURS,
  minBatch = 2,
  maxBatch = 6,
} = {}) {
  const count = Math.max(0, Number.parseInt(activeCount, 10) || 0);
  const interval = Number(intervalHours);
  const target = Number(targetHours);
  const minimum = Math.max(1, Number.parseInt(minBatch, 10) || 2);
  const maximum = Math.max(minimum, Number.parseInt(maxBatch, 10) || 6);
  if (count === 0) return 0;
  if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(target) || target <= 0) return Math.min(maximum, Math.max(minimum, count));
  const cyclesPerTarget = Math.max(1, Math.floor(target / interval));
  const required = Math.ceil(count / cyclesPerTarget);
  return Math.min(maximum, Math.max(minimum, required));
}

function freshnessCapacity({ intervalHours = DEFAULT_VERIFICATION_INTERVAL_HOURS, targetHours = DEFAULT_PUBLIC_FRESHNESS_HOURS, maxBatch = 6 } = {}) {
  const interval = Math.max(1, Number(intervalHours) || DEFAULT_VERIFICATION_INTERVAL_HOURS);
  const target = Math.max(interval, Number(targetHours) || DEFAULT_PUBLIC_FRESHNESS_HOURS);
  const cycles = Math.max(1, Math.floor(target / interval));
  return cycles * Math.max(1, Number.parseInt(maxBatch, 10) || 6);
}

module.exports = {
  verificationBatchSize,
  freshnessCapacity,
  DEFAULT_PUBLIC_FRESHNESS_HOURS,
  DEFAULT_VERIFICATION_INTERVAL_HOURS,
};
