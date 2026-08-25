import { useState, useLayoutEffect } from 'react';

/**
 * Returns the current pixel dimensions of a ref'd element.
 * Returns null until the first measurement lands (before paint).
 */
export function useSize(ref) {
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () =>
      setSize({ width: el.offsetWidth, height: el.offsetHeight });

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
