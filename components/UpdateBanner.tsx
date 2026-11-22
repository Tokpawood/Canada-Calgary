"use client";

import { useEffect, useState } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/**
 * L'application installée sur l'iPad reste ouverte des jours entiers et garde l'ancienne version.
 * Au retour sur l'app (et toutes les 10 min), on compare avec la version en ligne et on propose de recharger.
 */
export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (BUILD === "dev") return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 60_000)
        return;
      last = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { version } = (await res.json()) as { version?: string };
        if (version && version !== "dev" && version !== BUILD) setStale(true);
      } catch {
        /* hors connexion : on verra plus tard */
      }
    };
    const timer = setInterval(check, 10 * 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  if (!stale) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px]"
    >
      <span className="flex-1">
        <strong className="font-semibold">Nouvelle version disponible.</strong>{" "}
        Rechargez pour profiter des dernières corrections (un test en cours
        reprend là où vous en étiez).
      </span>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => window.location.reload()}
      >
        Recharger
      </button>
    </div>
  );
}
