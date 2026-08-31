const GUEST_ID_RE = /^guest_[a-z0-9_-]{9,80}$/i;

function normalizeGuestId(value) {
  return String(value || '').trim();
}

function isValidGuestId(value) {
  return GUEST_ID_RE.test(normalizeGuestId(value));
}

module.exports = { GUEST_ID_RE, normalizeGuestId, isValidGuestId };
