const RELOAD_KEY = 'dealscout:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 2 * 60 * 1000;

export function installChunkRecovery(target, now = Date.now) {
  const recover = event => {
    try {
      const at = now();
      const storage = target.sessionStorage;
      const previous = Number(storage.getItem(RELOAD_KEY));
      if (!Number.isFinite(at) || at <= 0 || (Number.isFinite(previous) && previous > 0 && at - previous < RELOAD_COOLDOWN_MS)) return;
      // Persist before reloading so another failed import cannot create a loop.
      // If session storage is unavailable, leave the existing manual recovery.
      storage.setItem(RELOAD_KEY, String(at));
      target.location.reload();
      event.preventDefault();
    } catch { /* The app boundary still offers manual reload. */ }
  };
  target.addEventListener('vite:preloadError', recover);
  return () => target.removeEventListener('vite:preloadError', recover);
}
