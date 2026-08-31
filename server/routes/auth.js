const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const users = require('../repositories/userRepository');
const mailer = require('../services/mailService');
const { hashSecret, matchesHashedOrLegacySecret } = require('../services/authSecretService');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';
const OTP_TTL = 15 * 60 * 1000;
const MAX_RATE_BUCKETS = 5000;
const rateBuckets = new Map();
let limiterOps = 0;

function assertJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
}
function makeToken(user) {
  assertJwtSecret();
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validPassword(password) { return typeof password === 'string' && password.length >= 8 && password.length <= 200; }
function randomOtp() { return crypto.randomInt(100000, 1000000).toString(); }
function isDevelopment() { return process.env.NODE_ENV !== 'production'; }

function pruneRateBuckets(now) {
  limiterOps += 1;
  if (limiterOps % 100 !== 0 && rateBuckets.size < MAX_RATE_BUCKETS) return;

  for (const [key, bucket] of rateBuckets) {
    if (!bucket?.expiresAt || bucket.expiresAt <= now) rateBuckets.delete(key);
  }

  while (rateBuckets.size >= MAX_RATE_BUCKETS) {
    const oldestKey = rateBuckets.keys().next().value;
    if (oldestKey === undefined) break;
    rateBuckets.delete(oldestKey);
  }
}

function limiter(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const now = Date.now();
    pruneRateBuckets(now);
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      bucket = { startedAt: now, expiresAt: now + windowMs, count: 0 };
      rateBuckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    next();
  };
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    console.error('[auth] me lookup failed:', err.message);
    res.status(503).json({ error: 'Authentication service is temporarily unavailable' });
  }
});

router.post('/login', limiter('login', 10, 10 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = await users.findByEmail(email);
    const passwordMatches = user?.password ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordMatches) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.verified) return res.status(403).json({ error: 'Email not verified' });
    return res.json({ access_token: makeToken(user), user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    if (err.message?.includes('JWT_SECRET')) return res.status(503).json({ error: 'Authentication is not configured' });
    console.error('[auth] login failed:', err.message);
    return res.status(503).json({ error: 'Authentication service is temporarily unavailable' });
  }
});

router.post('/register', limiter('register', 5, 15 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!validEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!validPassword(password)) return res.status(400).json({ error: 'Password must be 8-200 characters' });
  if (!isDevelopment() && !mailer.isConfigured()) return res.status(503).json({ error: 'Email verification is temporarily unavailable' });

  try {
    if (await users.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
    const otp = randomOtp();
    const passwordHash = await bcrypt.hash(password, 12);
    await users.create({
      id: uuidv4(),
      email,
      password: passwordHash,
      role: 'user',
      verified: 0,
      otp_code: hashSecret(otp),
      otp_expires: Date.now() + OTP_TTL,
      reset_token: null,
      reset_expires: null,
      created_at: Math.floor(Date.now() / 1000),
    });

    try {
      if (mailer.isConfigured()) await mailer.sendVerificationCode(email, otp);
    } catch (err) {
      console.error('[auth] Verification email failed:', err.message);
      if (!isDevelopment()) return res.status(503).json({ error: 'Verification email could not be sent. Please use resend later.' });
    }

    const payload = { message: 'Verification code sent.' };
    if (isDevelopment()) payload.otpCode = otp;
    res.status(201).json(payload);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error('[auth] registration failed:', err.message);
    res.status(503).json({ error: 'Authentication service is temporarily unavailable' });
  }
});

router.post('/verify-otp', limiter('verify', 10, 15 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otpCode = String(req.body?.otpCode || '').trim();
  if (!/^\d{6}$/.test(otpCode)) return res.status(400).json({ error: 'Invalid or expired verification code' });
  try {
    const user = await users.findByEmail(email);
    if (!user || !matchesHashedOrLegacySecret(user.otp_code, otpCode) || !user.otp_expires || Date.now() > Number(user.otp_expires)) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    const updated = await users.updateFields(user.id, { verified: 1, otp_code: null, otp_expires: null });
    return res.json({ access_token: makeToken(updated), user: { id: updated.id, email: updated.email, role: updated.role } });
  } catch (err) {
    if (err.message?.includes('JWT_SECRET')) return res.status(503).json({ error: 'Authentication is not configured' });
    console.error('[auth] verification failed:', err.message);
    res.status(503).json({ error: 'Authentication service is temporarily unavailable' });
  }
});

router.post('/resend-otp', limiter('resend', 5, 15 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  let devOtp = null;
  try {
    const user = await users.findByEmail(email);
    if (user && !user.verified) {
      const otp = randomOtp();
      await users.updateFields(user.id, { otp_code: hashSecret(otp), otp_expires: Date.now() + OTP_TTL });
      devOtp = otp;
      if (mailer.isConfigured()) {
        try { await mailer.sendVerificationCode(email, otp); }
        catch (err) { console.error('[auth] Resend verification email failed:', err.message); }
      }
    }
  } catch (err) {
    console.error('[auth] resend lookup failed:', err.message);
  }
  const payload = { message: 'If the account exists and is unverified, a verification code will be sent.' };
  if (isDevelopment() && devOtp) payload.otpCode = devOtp;
  res.json(payload);
});

router.post('/forgot-password', limiter('forgot', 5, 15 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  let devToken = null;
  try {
    const user = await users.findByEmail(email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await users.updateFields(user.id, { reset_token: hashSecret(rawToken), reset_expires: Date.now() + 60 * 60 * 1000 });
      devToken = rawToken;
      if (mailer.isConfigured()) {
        try { await mailer.sendPasswordReset(email, rawToken); }
        catch (err) { console.error('[auth] Password reset email failed:', err.message); }
      }
    }
  } catch (err) {
    console.error('[auth] forgot-password lookup failed:', err.message);
  }
  const payload = { message: 'If that email exists, a reset link has been sent' };
  if (isDevelopment() && devToken) payload.resetToken = devToken;
  res.json(payload);
});

router.post('/reset-password', limiter('reset', 10, 15 * 60 * 1000), async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !validPassword(newPassword)) return res.status(400).json({ error: 'Valid token and password (8-200 characters) required' });
  try {
    const tokenHash = hashSecret(String(resetToken));
    const user = await users.findByResetToken(tokenHash);
    if (!user || !user.reset_expires || Date.now() > Number(user.reset_expires)) return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    await users.updateFields(user.id, {
      password: await bcrypt.hash(newPassword, 12),
      reset_token: null,
      reset_expires: null,
    });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('[auth] reset-password failed:', err.message);
    res.status(503).json({ error: 'Authentication service is temporarily unavailable' });
  }
});

module.exports = router;