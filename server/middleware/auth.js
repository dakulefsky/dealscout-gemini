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

async function optionalAuth(req, _res, next) {
  try {
    const tokenUser = verifyBearer(req);
    if (!tokenUser) {
      req.user = null;
      return next();
    }
    const currentUser = await users.findById(tokenUser.id);
    req.user = currentUser && currentUser.verified
      ? { ...tokenUser, email: currentUser.email, role: currentUser.role }
      : null;
  } catch {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  try {
    const user = verifyBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (err) {
    if (/JWT_SECRET/.test(err.message)) return res.status(503).json({ error: 'Authentication is not configured' });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const currentUser = await users.findById(req.user.id);
      if (!currentUser || currentUser.role !== 'admin' || !currentUser.verified) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = {
        ...req.user,
        email: currentUser.email,
        role: currentUser.role,
      };
      next();
    } catch (err) {
      console.error('[auth] admin authorization lookup failed:', err.message);
      return res.status(503).json({ error: 'Authorization service is temporarily unavailable' });
    }
  });
}

module.exports = { optionalAuth, requireAuth, requireAdmin };
