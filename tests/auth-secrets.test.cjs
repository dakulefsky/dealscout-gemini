const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { hashSecret, matchesHashedOrLegacySecret } = require('../server/services/authSecretService');

const authRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'auth.js'), 'utf8');

test('auth secrets are hashed deterministically and compared without plaintext storage', () => {
  const hash = hashSecret('123456');
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(matchesHashedOrLegacySecret(hash, '123456'), true);
  assert.equal(matchesHashedOrLegacySecret(hash, '654321'), false);
});

test('legacy plaintext OTPs remain compatible during migration', () => {
  assert.equal(matchesHashedOrLegacySecret('123456', '123456'), true);
  assert.equal(matchesHashedOrLegacySecret('123456', '123455'), false);
  assert.equal(matchesHashedOrLegacySecret('', '123456'), false);
});

test('registration and resend store OTP hashes while development responses can keep the raw delivery code', () => {
  assert.match(authRoute, /otp_code: hashSecret\(otp\)/);
  assert.match(authRoute, /updateFields\(user\.id, \{ otp_code: hashSecret\(otp\), otp_expires:/);
  assert.match(authRoute, /matchesHashedOrLegacySecret\(user\.otp_code, otpCode\)/);
  assert.doesNotMatch(authRoute, /user\.otp_code !== otpCode/);
  assert.match(authRoute, /if \(isDevelopment\(\)\) payload\.otpCode = otp/);
});

test('password reset tokens share the same hash helper', () => {
  assert.match(authRoute, /reset_token: hashSecret\(rawToken\)/);
  assert.match(authRoute, /const tokenHash = hashSecret\(String\(resetToken\)\)/);
});
