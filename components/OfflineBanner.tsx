"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Bandeau affiché quand l'appareil perd la connexion : la consultation reste possible, pas l'enregistrement. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-xl border border-opt/40 bg-signal-soft px-3.5 py-2.5 text-[13px] text-opt"
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-px shrink-0"
      >
        <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.4-1.7M1.4 9a15 15 0 0 1 4.3-2.6M22.6 9A15 15 0 0 0 11 5.1M12 20h.01" />
      </svg>
      <span>
        <strong className="font-semibold">Hors connexion.</strong> Vous pouvez
        consulter les pages déjà ouvertes, mais les modifications ne seront pas
        enregistrées avant le retour du réseau.
      </span>
    </div>
  );
}
