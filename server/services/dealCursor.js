const SUPPORTED_SORTS = new Set(['-created_date', 'discount_desc', 'price_asc', 'price_desc']);

function encodeCursor(payload) {
  const value = {
    v: 1,
    sort: payload.sort,
    primary: payload.primary,
    createdAt: Number(payload.createdAt),
    id: String(payload.id || ''),
  };
  if (!SUPPORTED_SORTS.has(value.sort) || !Number.isFinite(value.createdAt) || !value.id) {
    throw new Error('Invalid cursor payload');
  }
  if (value.sort !== '-created_date' && !Number.isFinite(Number(value.primary))) {
    throw new Error('Invalid cursor payload');
  }
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(value, expectedSort) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (decoded?.v !== 1 || !SUPPORTED_SORTS.has(decoded.sort) || decoded.sort !== expectedSort) return null;
    const cursor = {
      v: 1,
      sort: decoded.sort,
      primary: decoded.primary,
      createdAt: Number(decoded.createdAt),
      id: String(decoded.id || ''),
    };
    if (!Number.isFinite(cursor.createdAt) || !cursor.id) return null;
    if (cursor.sort !== '-created_date' && !Number.isFinite(Number(cursor.primary))) return null;
    return cursor;
  } catch {
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor, SUPPORTED_SORTS };
