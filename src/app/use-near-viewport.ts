import { useCallback, useRef, useState } from "react";

export function useNearViewport<T extends Element>(): [(node: T | null) => void, boolean] {
  const [near, setNear] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const ref = useCallback(
    (node: T | null) => {
      observer.current?.disconnect();
      if (!node || near) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          setNear(true);
          observer.current?.disconnect();
        },
        { root: node.closest("[data-ivar-scroll-root]"), rootMargin: "100% 0px" },
      );
      observer.current.observe(node);
    },
    [near],
  );
  return [ref, near];
}
