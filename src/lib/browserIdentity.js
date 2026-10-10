export function createBrowserIdentity({ storage = () => globalThis.localStorage, crypto = globalThis.crypto } = {}) {
  const tokenKey = 'ds_token';
  const guestKey = 'ds_guest_id';
  let fallbackGuestId = null;

  function randomGuestId() {
    if (crypto?.randomUUID) return `guest_${crypto.randomUUID()}`;
    const bytes = new Uint8Array(16);
    crypto?.getRandomValues?.(bytes);
    if (bytes.some(Boolean)) return `guest_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }

  function getToken() {
    try { return storage().getItem(tokenKey); }
    catch { return null; }
  }

  function setToken(token) {
    try {
      if (token) storage().setItem(tokenKey, token);
      else storage().removeItem(tokenKey);
    } catch {
      // The login page reloads after signing in, so an in-memory token would
      // disappear immediately. Explain the storage issue instead of looping.
      if (token) throw new Error('Browser storage is blocked. Allow site storage to sign in.');
    }
  }

  function getGuestId() {
    try {
      const saved = storage().getItem(guestKey);
      if (saved) { fallbackGuestId = saved; return saved; }
    } catch { /* Browsing must work when storage access is restricted. */ }
    fallbackGuestId ||= randomGuestId();
    try { storage().setItem(guestKey, fallbackGuestId); }
    catch { /* Keep one identity for this page session. */ }
    return fallbackGuestId;
  }

  return { getToken, setToken, getGuestId };
}
