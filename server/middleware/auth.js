const jwt = require('jsonwebtoken');
const users = require('../repositories/userRepository');

const JWT_SECRET = process.env.JWT_SECRET;

function requireJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
}

function verifyBearer(req) {
  requireJwtSecret();
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return jwt.verify(header.slice(7), JWT_SECRET);
}

function tokenVersionOf(value) {
  const version = Number(value ?? 0);
  return Number.isInteger(version) && version >= 0 ? version : 0;
}

async function resolveCurrentUser(tokenUser) {
  if (!tokenUser?.id) return null;
  const currentUser = await users.findById(tokenUser.id);
  if (!currentUser) return null;
  if (tokenVersionOf(tokenUser.authVersion) !== tokenVersionOf(currentUser.token_version)) return null;
  return {
    ...tokenUser,
    email: currentUser.email,
    role: currentUser.role,
    verified: currentUser.verified === 1 || currentUser.verified === true,
    authVersion: tokenVersionOf(currentUser.token_version),
  };
}

async function optionalAuth(req, _res, next) {
  try {
    const tokenUser = verifyBearer(req);
    if (!tokenUser) {
      req.user = null;
      return next();
    }
    const currentUser = await resolveCurrentUser(tokenUser);
    req.user = currentUser?.verified ? currentUser : null;
  } catch {
    req.user = null;
  }
  next();
}

async function requireAuth(req, res, next) {
  try {
    const tokenUser = verifyBearer(req);
    if (!tokenUser) return res.status(401).json({ error: 'Unauthorized' });
    const currentUser = await resolveCurrentUser(tokenUser);
    if (!currentUser) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = currentUser;
    next();
  } catch (err) {
    if (/JWT_SECRET/.test(err.message)) return res.status(503).json({ error: 'Authentication is not configured' });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin' || !req.user.verified) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  });
}

module.exports = { optionalAuth, requireAuth, requireAdmin };
