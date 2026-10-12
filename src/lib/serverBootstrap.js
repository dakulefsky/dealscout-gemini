const IDS = ['initial-deals', 'initial-scoped-deals', 'initial-guide-deals'];

// Capture public JSON before React replaces the server HTML. Lazy routes may
// mount after those DOM nodes are gone; keep their original scoped payload.
export function createServerBootstrapReader() {
  let pages = null;
  return {
    capture(document) {
      if (pages !== null) return;
      pages = new Map();
      for (const id of IDS) {
        try {
          const page = JSON.parse(document.getElementById(id)?.textContent || 'null');
          pages.set(id, page && typeof page === 'object' && !Array.isArray(page) ? page : null);
        } catch { pages.set(id, null); }
      }
    },
    read(id) { return pages?.get(id) || null; },
  };
}

const reader = createServerBootstrapReader();
export const captureServerBootstrap = document => reader.capture(document);
export const readServerBootstrap = id => reader.read(id);
