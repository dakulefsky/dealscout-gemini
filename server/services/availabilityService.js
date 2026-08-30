function cleanAvailability(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function isUnavailableAvailability(value) {
  const text = cleanAvailability(value).toLowerCase();
  if (!text) return false;
  return /out of stock|unavailable|no featured offers|not available/.test(text);
}

function normalizeAvailability(value) {
  const text = cleanAvailability(value);
  if (!text) return null;
  return isUnavailableAvailability(text) ? 'Unavailable' : text;
}

module.exports = { cleanAvailability, isUnavailableAvailability, normalizeAvailability };
