"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      return;
    }
    // En dev, les fichiers /_next/static ne portent pas d'empreinte : un cache-first servirait du code périmé.
    void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if ("caches" in window) void caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }, []);
  return null;
}
