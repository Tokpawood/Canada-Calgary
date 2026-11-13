"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IconFile,
  IconLock,
  IconLogout,
  IconMonitor,
  IconMoon,
  IconPiggy,
  IconRoute,
  IconSun,
  IconUser,
  IconUsers,
  IconWallet,
} from "./icons";

export interface ShellSummary {
  overallPct: number;
  nextStep: { title: string; dueLabel: string | null; late: boolean } | null;
  countdown: { label: string; date: string | null; late: boolean } | null;
  lateSteps: number;
  docs: { obtained: number; total: number };
}

const NAV: Array<{ href: string; label: string; icon: (p: { size?: number }) => ReactNode; ownerOnly?: boolean }> = [
  { href: "/parcours", label: "Parcours", icon: IconRoute },
  { href: "/profil", label: "Profil", icon: IconUser, ownerOnly: true },
  { href: "/documents", label: "Documents", icon: IconFile },
  { href: "/budget", label: "Budget", icon: IconWallet },
  { href: "/epargne", label: "Épargne", icon: IconPiggy },
  { href: "/contacts", label: "Contacts", icon: IconUsers },
  { href: "/coffre", label: "Coffre", icon: IconLock, ownerOnly: true },
];

export function AppShell({
  summary,
  isOwner,
  email,
  children,
}: {
  summary: ShellSummary | null;
  isOwner: boolean;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const nav = NAV.filter((n) => isOwner || !n.ownerOnly);

  // La molette modifie la valeur d'un champ numérique qui a le focus : on le quitte avant que la page défile.
  useEffect(() => {
    const onWheel = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "number") el.blur();
    };
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  function badgeFor(href: string): { text: string; alert: boolean } | null {
    if (!summary) return null;
    if (href === "/parcours" && summary.lateSteps > 0) return { text: String(summary.lateSteps), alert: true };
    if (href === "/documents" && summary.docs.total > 0) return { text: `${summary.docs.obtained}/${summary.docs.total}`, alert: false };
    return null;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-white/10 bg-night px-4 py-5 text-night-ink lg:flex">
        <Link href="/parcours" className="flex items-baseline gap-2 px-2 font-mono font-semibold">
          <span className="text-xl tracking-wide">ABJ</span>
          <span className="text-signal">→</span>
          <span className="text-xl tracking-wide">YYC</span>
        </Link>
        <p className="px-2 text-[12px] text-night-muted">Entrée express · Calgary</p>

        {summary && <JourneyCard summary={summary} />}

        <nav aria-label="Sections" className="mt-5 flex flex-col gap-0.5">
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            const badge = badgeFor(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors ${
                  active ? "bg-white/10 text-night-ink" : "text-night-muted hover:bg-white/5 hover:text-night-ink"
                }`}
              >
                <span className={active ? "text-signal" : ""}>
                  <Icon size={18} />
                </span>
                <span className="flex-1">{n.label}</span>
                {badge && (
                  <span
                    className={`mono rounded-md px-1.5 py-0.5 text-[11px] ${
                      badge.alert ? "bg-[#f29a90] text-[#2a0b08]" : "bg-white/10 text-night-muted"
                    }`}
                    title={badge.alert ? "Étapes en retard" : "Documents obtenus"}
                  >
                    {badge.text}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <ThemeToggle />
          <p className="mt-3 truncate px-2 text-[12px] text-night-muted" title={email}>
            {email}
          </p>
          <SignOut />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-white/10 bg-night text-night-ink lg:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/parcours" className="flex items-baseline gap-1.5 font-mono font-semibold">
              <span>ABJ</span>
              <span className="text-signal">→</span>
              <span>YYC</span>
            </Link>
            <div className="flex items-center gap-2">
              {summary && <span className="mono rounded-md bg-white/10 px-2 py-0.5 text-[12px]">{summary.overallPct} %</span>}
              <ThemeToggle compact />
              <SignOut compact />
            </div>
          </div>
          <nav aria-label="Sections" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2.5">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              const badge = badgeFor(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                    active ? "bg-white/15 text-night-ink" : "text-night-muted"
                  }`}
                >
                  {n.label}
                  {badge?.alert && <span className="h-1.5 w-1.5 rounded-full bg-[#f29a90]" />}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-9">{children}</main>
      </div>
    </div>
  );
}

function JourneyCard({ summary }: { summary: ShellSummary }) {
  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-night-2 p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-night-muted">Parcours</span>
        <span className="mono text-sm font-semibold">{summary.overallPct} %</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10">
        <span className="block h-full rounded-full bg-signal" style={{ width: `${Math.max(2, summary.overallPct)}%` }} />
      </div>
      {summary.nextStep && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-signal">Prochaine étape</p>
          <p className="mt-0.5 text-[13px] leading-snug font-semibold">{summary.nextStep.title}</p>
          {summary.nextStep.dueLabel && (
            <p className={`mono mt-1 text-[11.5px] ${summary.nextStep.late ? "text-[#f29a90]" : "text-night-muted"}`}>{summary.nextStep.dueLabel}</p>
          )}
        </div>
      )}
      {summary.countdown && (
        <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-2.5">
          <span className="text-[12px] text-night-muted">Profil Entrée express</span>
          <span className={`mono text-[13px] font-semibold ${summary.countdown.late ? "text-[#f29a90]" : "text-night-ink"}`}>{summary.countdown.label}</span>
        </div>
      )}
    </div>
  );
}

type ThemeChoice = "system" | "light" | "dark";
const THEME_ORDER: ThemeChoice[] = ["system", "light", "dark"];
const THEME_LABEL: Record<ThemeChoice, string> = { system: "Thème système", light: "Thème clair", dark: "Thème sombre" };

const themeListeners = new Set<() => void>();

function readTheme(): ThemeChoice {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as ThemeChoice);

  function cycle() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(readTheme()) + 1) % THEME_ORDER.length];
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    document.cookie = next === "system" ? "theme=; path=/; max-age=0; samesite=lax" : `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    themeListeners.forEach((l) => l());
  }

  const Icon = theme === "light" ? IconSun : theme === "dark" ? IconMoon : IconMonitor;

  if (compact) {
    return (
      <button type="button" onClick={cycle} aria-label={THEME_LABEL[theme]} title={THEME_LABEL[theme]} className="grid h-8 w-8 place-items-center rounded-lg text-night-muted hover:bg-white/10 hover:text-night-ink">
        <Icon size={17} />
      </button>
    );
  }
  return (
    <button type="button" onClick={cycle} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-night-muted hover:bg-white/5 hover:text-night-ink">
      <Icon size={17} />
      {THEME_LABEL[theme]}
    </button>
  );
}

function SignOut({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  if (compact) {
    return (
      <button type="button" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter" className="grid h-8 w-8 place-items-center rounded-lg text-night-muted hover:bg-white/10 hover:text-night-ink">
        <IconLogout size={17} />
      </button>
    );
  }
  return (
    <button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-night-muted hover:bg-white/5 hover:text-night-ink">
      <IconLogout size={17} />
      Se déconnecter
    </button>
  );
}
