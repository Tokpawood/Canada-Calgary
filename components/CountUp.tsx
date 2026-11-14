"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nombre qui « monte » jusqu'à sa valeur à l'affichage (et lors d'un changement).
 * Rendu serveur = valeur finale (pas de saut d'hydratation, lisible sans JavaScript).
 */
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current ?? 0;
    from.current = value;
    if (reduce || start === value) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{shown}</span>;
}
