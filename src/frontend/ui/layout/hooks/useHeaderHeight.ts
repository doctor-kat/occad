import { useEffect, useRef, useState } from 'react';

// Dynamically measure header height so sidebar/main offsets stay correct
// even when the toolbar scrollbar appears (e.g. narrow Firefox windows).
export function useHeaderHeight() {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(164);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) setHeaderHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { headerRef, headerHeight };
}
