const crypto = require('crypto');

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function safeEqualHex(left, right) {
  if (!SHA256_HEX.test(left) || !SHA256_HEX.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function matchesHashedOrLegacySecret(storedValue, suppliedValue) {
  const stored = String(storedValue ?? '').trim();
  const supplied = String(suppliedValue ?? '').trim();
  if (!stored || !supplied) return false;
  const expectedHash = SHA256_HEX.test(stored) ? stored.toLowerCase() : hashSecret(stored);
  return safeEqualHex(expectedHash, hashSecret(supplied));
}

module.exports = { hashSecret, matchesHashedOrLegacySecret };
