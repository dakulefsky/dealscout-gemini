const express = require('express');
const jwt = require('jsonwebtoken');
const users = require('../repositories/userRepository');
const pushDevices = require('../repositories/pushDeviceRepository');
const { normalizeGuestId, isValidGuestId } = require('../services/clientIdentityService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const EXPO_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const PLATFORMS = new Set(['ios', 'android']);

async function getClientIdentity(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') && JWT_SECRET && JWT_SECRET.length >= 32) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const user = await users.findById(decoded.id);
      const tokenVersion = Number(decoded.authVersion || 0);
      const currentVersion = Number(user?.token_version || 0);
      if (user && tokenVersion === currentVersion) return { id: user.id, authenticated: true };
    } catch {}
  }
  const guestId = normalizeGuestId(req.headers['x-guest-id']);
  if (!isValidGuestId(guestId)) return null;
  return { id: guestId, authenticated: false };
}

router.use(async (req, res, next) => {
  try {
    const identity = await getClientIdentity(req);
    if (!identity) return res.status(400).json({ error: 'A valid user or guest identity is required' });
    req.clientIdentity = identity;
    next();
  } catch (err) {
    console.error('[notifications] identity lookup failed:', err.message);
    return res.status(503).json({ error: 'Notification service is temporarily unavailable' });
  }
});

router.post('/devices', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const platform = String(req.body?.platform || '').trim().toLowerCase();
  if (!EXPO_TOKEN_RE.test(token)) return res.status(400).json({ error: 'A valid Expo push token is required' });
  if (!PLATFORMS.has(platform)) return res.status(400).json({ error: 'platform must be ios or android' });

  try {
    const device = await pushDevices.upsertDevice({ userId: req.clientIdentity.id, token, platform });
    return res.json({ success: true, device: { id: device.id, platform: device.platform, enabled: device.enabled } });
  } catch (err) {
    console.error('[notifications] device registration failed:', err.message);
    return res.status(503).json({ error: 'Notification service is temporarily unavailable' });
  }
});

router.delete('/devices', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!EXPO_TOKEN_RE.test(token)) return res.status(400).json({ error: 'A valid Expo push token is required' });
  try {
    const disabled = await pushDevices.disableDevice(req.clientIdentity.id, token);
    return res.json({ success: true, disabled });
  } catch (err) {
    console.error('[notifications] device disable failed:', err.message);
    return res.status(503).json({ error: 'Notification service is temporarily unavailable' });
  }
});

module.exports = router;
