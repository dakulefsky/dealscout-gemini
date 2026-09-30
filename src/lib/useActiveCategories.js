import { useEffect, useState } from 'react';
import { getActiveCategories } from './publicCatalogCache';

export function useActiveCategories(enabled = true) {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      getActiveCategories().then((rows) => {
        if (!stopped) setCategories(rows || []);
      }).catch(() => { /* Retain the last successful list during an outage. */ });
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);
  return categories;
}
