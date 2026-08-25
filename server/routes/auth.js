const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES = '7d';

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// GET /api/auth/me
router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.password) return res.status(401).json({ error: 'Invalid email or password' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.verified) return res.status(403).json({ error: 'Email not verified' });

  res.json({ access_token: makeToken(user), user: { id: user.id, email: user.email, role: user.role } });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 15 * 60 * 1000; // 15 min
  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();

  db.prepare(
    'INSERT INTO users (id, email, password, otp_code, otp_expires) VALUES (?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase(), hash, otp, expires);

  // In production wire up a real mailer; for local dev we log to console.
  console.log(`[auth] OTP for ${email}: ${otp}`);
  res.json({ message: 'Registration started — check console for OTP (local dev)' });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, otpCode } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.otp_code !== otpCode) return res.status(400).json({ error: 'Invalid verification code' });
  if (Date.now() > user.otp_expires) return res.status(400).json({ error: 'Code expired — request a new one' });

  db.prepare('UPDATE users SET verified = 1, otp_code = NULL, otp_expires = NULL WHERE id = ?').run(user.id);
  res.json({ access_token: makeToken(user) });
});

// POST /api/auth/resend-otp
router.post('/resend-otp', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 15 * 60 * 1000;
  db.prepare('UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?').run(otp, expires, user.id);
  console.log(`[auth] Resent OTP for ${email}: ${otp}`);
  res.json({ message: 'OTP resent — check console (local dev)' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
  if (user) {
    const token = uuidv4();
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, user.id);
    console.log(`[auth] Password reset link for ${email}: http://localhost:5173/reset-password?token=${token}`);
  }
  // Always respond success (don't leak whether email exists)
  res.json({ message: 'If that email exists, a reset link has been sent (check console for local dev)' });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(resetToken);
  if (!user || Date.now() > user.reset_expires) {
    return res.status(400).json({ error: 'Reset link is invalid or has expired' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hash, user.id);
  res.json({ message: 'Password reset successfully' });
});

module.exports = router;
