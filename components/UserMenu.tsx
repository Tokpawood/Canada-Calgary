"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Account } from "@/lib/account";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/avatarUpload";
import { Avatar } from "./Avatar";
import { ThemeSegment } from "./Theme";
import { IconChevronDown, IconLogout, IconShield, IconUpload } from "./icons";

/**
 * Pied de la barre latérale : carte du titulaire (photo, prénom et nom, courriel).
 * Un clic ouvre un menu : photo de profil, Compte et sécurité, thème, déconnexion.
 */
export function UserMenu({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Fermeture : clic à l'extérieur, Échap, ou changement de page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  async function onPhoto(file: File) {
    setBusy(true);
    setError(null);
    const err = await uploadAvatar(file);
    setBusy(false);
    if (err) setError(err);
    else router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={root} className="relative">
      {open && (
        <div
          role="menu"
          aria-label="Compte"
          className="user-menu absolute right-0 bottom-[calc(100%+10px)] left-0 z-40 overflow-hidden rounded-2xl border border-white/10 bg-night-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
        >
          <div className="flex flex-col items-center px-4 pt-5 pb-4 text-center">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="group/photo relative rounded-full focus-visible:outline-offset-4"
              title="Changer la photo de profil"
            >
              <Avatar url={account.avatarUrl} initials={account.initials} size={64} />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover/photo:opacity-100">
                <IconUpload size={18} />
              </span>
              {busy && <span className="absolute inset-0 animate-pulse rounded-full bg-black/40" />}
            </button>
            <p className="mt-2.5 text-[14.5px] font-bold text-night-ink">{account.fullName}</p>
            <p className="max-w-full truncate text-[11.5px] text-night-muted">{account.email}</p>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="mt-2 text-[11.5px] font-semibold text-signal hover:underline">
              {busy ? "Envoi de la photo…" : account.avatarUrl ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {error && <p className="mt-1.5 text-[11.5px] text-[#f6b4ac]">{error}</p>}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onPhoto(f);
              }}
            />
          </div>

          <div className="border-t border-white/10 p-1.5">
            <Link
              href="/compte"
              role="menuitem"
              className="nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-night-muted hover:bg-white/5 hover:text-night-ink"
            >
              <IconShield size={16} /> Compte et sécurité
            </Link>
          </div>

          <div className="border-t border-white/10 px-3 pt-2.5 pb-3">
            <p className="text-[10.5px] font-semibold tracking-[0.12em] text-night-muted uppercase">Apparence</p>
            <ThemeSegment />
          </div>

          <div className="border-t border-white/10 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              className="nav-link flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-night-muted hover:bg-[#f29a90]/10 hover:text-[#f6b4ac]"
            >
              <IconLogout size={16} /> Se déconnecter
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-[background-color,border-color] duration-200 ${
          open ? "border-white/20 bg-white/10" : "border-white/10 bg-night-2 hover:border-white/20 hover:bg-white/5"
        }`}
      >
        <Avatar url={account.avatarUrl} initials={account.initials} size={38} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-night-ink">{account.fullName}</span>
          <span className="block truncate text-[11px] text-night-muted">{account.email}</span>
        </span>
        <IconChevronDown size={16} className={`shrink-0 text-night-muted transition-transform duration-300 ${open ? "" : "rotate-180"}`} />
      </button>
    </div>
  );
}
