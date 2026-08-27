const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const mailer = require('../services/mailService');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';
const OTP_TTL = 15 * 60 * 1000;
const rateBuckets = new Map();

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
function hashToken(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function isDevelopment() { return process.env.NODE_ENV !== 'production'; }

function limiter(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const now = Date.now();
    let bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      bucket = { startedAt: now, count: 0 };
      rateBuckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    next();
  };
}

router.get('/me', (req, res) => {
  try { assertJwtSecret(); } catch { return res.status(503).json({ error: 'Authentication is not configured' }); }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = db.tables.users.find((u) => u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/login', limiter('login', 10, 10 * 60 * 1000), (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.tables.users.find((u) => u.email === email);
  if (!user || !user.password || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.verified) return res.status(403).json({ error: 'Email not verified' });
  try {
    return res.json({ access_token: makeToken(user), user: { id: user.id, email: user.email, role: user.role } });
  } catch {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }
});

router.post('/register', limiter('register', 5, 15 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!validEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!validPassword(password)) return res.status(400).json({ error: 'Password must be 8-200 characters' });
  if (db.tables.users.some((u) => u.email === email)) return res.status(409).json({ error: 'Email already registered' });
  if (!isDevelopment() && !mailer.isConfigured()) return res.status(503).json({ error: 'Email verification is temporarily unavailable' });

  const otp = randomOtp();
  const id = uuidv4();
  db.tables.users.push({
    id,
    email,
    password: bcrypt.hashSync(password, 12),
    role: 'user',
    verified: 0,
    otp_code: otp,
    otp_expires: Date.now() + OTP_TTL,
    reset_token: null,
    reset_expires: null,
    created_at: Math.floor(Date.now() / 1000),
  });
  db.saveDb();

  try {
    if (mailer.isConfigured()) await mailer.sendVerificationCode(email, otp);
  } catch (err) {
    console.error('[auth] Verification email failed:', err.message);
    if (!isDevelopment()) return res.status(503).json({ error: 'Verification email could not be sent. Please use resend later.' });
  }

  const payload = { message: 'Verification code sent.' };
  if (isDevelopment()) payload.otpCode = otp;
  res.status(201).json(payload);
});

router.post('/verify-otp', limiter('verify', 10, 15 * 60 * 1000), (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otpCode = String(req.body?.otpCode || '').trim();
  const user = db.tables.users.find((u) => u.email === email);
  if (!user || user.otp_code !== otpCode || !user.otp_expires || Date.now() > user.otp_expires) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }
  user.verified = 1;
  user.otp_code = null;
  user.otp_expires = null;
  db.saveDb();
  try {
    return res.json({ access_token: makeToken(user), user: { id: user.id, email: user.email, role: user.role } });
  } catch {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }
});

router.post('/resend-otp', limiter('resend', 5, 15 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = db.tables.users.find((u) => u.email === email);
  let devOtp = null;
  if (user && !user.verified) {
    user.otp_code = randomOtp();
    user.otp_expires = Date.now() + OTP_TTL;
    db.saveDb();
    devOtp = user.otp_code;
    if (mailer.isConfigured()) {
      try { await mailer.sendVerificationCode(email, user.otp_code); }
      catch (err) { console.error('[auth] Resend verification email failed:', err.message); }
    }
  }
  const payload = { message: 'If the account exists and is unverified, a verification code will be sent.' };
  if (isDevelopment() && devOtp) payload.otpCode = devOtp;
  res.json(payload);
});

router.post('/forgot-password', limiter('forgot', 5, 15 * 60 * 1000), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = db.tables.users.find((u) => u.email === email);
  let devToken = null;
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.reset_token = hashToken(rawToken);
    user.reset_expires = Date.now() + 60 * 60 * 1000;
    db.saveDb();
    devToken = rawToken;
    if (mailer.isConfigured()) {
      try { await mailer.sendPasswordReset(email, rawToken); }
      catch (err) { console.error('[auth] Password reset email failed:', err.message); }
    }
  }
  const payload = { message: 'If that email exists, a reset link has been sent' };
  if (isDevelopment() && devToken) payload.resetToken = devToken;
  res.json(payload);
});

router.post('/reset-password', limiter('reset', 10, 15 * 60 * 1000), (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !validPassword(newPassword)) return res.status(400).json({ error: 'Valid token and password (8-200 characters) required' });
  const tokenHash = hashToken(String(resetToken));
  const user = db.tables.users.find((u) => u.reset_token === tokenHash);
  if (!user || !user.reset_expires || Date.now() > user.reset_expires) return res.status(400).json({ error: 'Reset link is invalid or has expired' });
  user.password = bcrypt.hashSync(newPassword, 12);
  user.reset_token = null;
  user.reset_expires = null;
  db.saveDb();
  res.json({ message: 'Password reset successfully' });
});

module.exports = router;
