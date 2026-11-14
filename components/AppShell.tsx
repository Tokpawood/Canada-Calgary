"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IconArrowRight,
  IconFile,
  IconLock,
  IconLogout,
  IconMonitor,
  IconMoon,
  IconPiggy,
  IconPlane,
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

type NavItem = { href: string; label: string; icon: (p: { size?: number }) => ReactNode; ownerOnly?: boolean };

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Suivi",
    items: [
      { href: "/parcours", label: "Parcours", icon: IconRoute },
      { href: "/documents", label: "Documents", icon: IconFile },
      { href: "/budget", label: "Budget", icon: IconWallet },
      { href: "/epargne", label: "Épargne", icon: IconPiggy },
    ],
  },
  {
    title: "Dossier",
    items: [
      { href: "/profil", label: "Profil", icon: IconUser, ownerOnly: true },
      { href: "/contacts", label: "Contacts", icon: IconUsers },
      { href: "/coffre", label: "Coffre", icon: IconLock, ownerOnly: true },
    ],
  },
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
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => isOwner || !n.ownerOnly) })).filter((g) => g.items.length);
  const nav = groups.flatMap((g) => g.items);

  // La molette modifie la valeur d'un champ numérique qui a le focus : on le quitte avant que la page défile.
  useEffect(() => {
    const onWheel = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "number") el.blur();
    };
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  function badgeFor(href: string): { text: string; alert: boolean; title: string } | null {
    if (!summary) return null;
    if (href === "/parcours" && summary.lateSteps > 0) return { text: String(summary.lateSteps), alert: true, title: "Étapes en retard" };
    if (href === "/documents" && summary.docs.total > 0) return { text: `${summary.docs.obtained}/${summary.docs.total}`, alert: false, title: "Documents obtenus" };
    return null;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-white/10 bg-night px-4 pt-5 pb-4 text-night-ink lg:flex">
        <Link href="/parcours" className="flex items-center gap-3 rounded-xl px-1.5 py-1">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-signal text-[#1b1206]">
            <IconPlane size={19} />
          </span>
          <span className="min-w-0">
            <span className="flex items-baseline gap-1.5 font-mono text-[17px] leading-tight font-semibold tracking-wide">
              ABJ <span className="text-signal">→</span> YYC
            </span>
            <span className="block text-[11.5px] text-night-muted">Entrée express · Calgary</span>
          </span>
        </Link>

        {summary && <JourneyCard summary={summary} />}

        <nav aria-label="Sections" className="mt-5 flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 text-[10.5px] font-semibold tracking-[0.14em] text-night-muted/70 uppercase">{g.title}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const active = pathname.startsWith(n.href);
                  const badge = badgeFor(n.href);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                        active ? "bg-white/10 text-night-ink" : "text-night-muted hover:bg-white/5 hover:text-night-ink"
                      }`}
                    >
                      {active && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-signal" />}
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${active ? "bg-signal/15 text-signal" : "group-hover:text-night-ink"}`}>
                        <Icon size={17} />
                      </span>
                      <span className="flex-1">{n.label}</span>
                      {badge && (
                        <span
                          className={`mono rounded-full px-1.5 text-[10.5px] leading-[18px] font-semibold ${badge.alert ? "bg-bad text-white" : "bg-white/10 text-night-muted"}`}
                          title={badge.title}
                        >
                          {badge.text}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto shrink-0 pt-5">
          <div className="rounded-xl border border-white/10 bg-night-2 p-2.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[13px] font-bold uppercase">{(email.trim()[0] ?? "?").toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold" title={email}>
                  {email}
                </span>
                <span className="block text-[11px] text-night-muted">{isOwner ? "Titulaire du dossier" : "Lecteur invité"}</span>
              </span>
              <SignOut compact />
            </div>
            <ThemeSegment />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-white/10 bg-night text-night-ink lg:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/parcours" className="flex items-center gap-2 font-mono font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-signal text-[#1b1206]">
                <IconPlane size={15} />
              </span>
              <span>
                ABJ <span className="text-signal">→</span> YYC
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {summary && (
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1">
                  <span className="h-1 w-10 overflow-hidden rounded-full bg-white/15">
                    <span className="block h-full rounded-full bg-signal" style={{ width: `${Math.max(4, summary.overallPct)}%` }} />
                  </span>
                  <span className="mono text-[12px]">{summary.overallPct} %</span>
                </span>
              )}
              <ThemeToggle />
              <SignOut compact />
            </div>
          </div>
          <nav aria-label="Sections" className="no-scrollbar flex gap-1 overflow-x-auto px-3">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              const badge = badgeFor(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-[13px] font-semibold ${
                    active ? "bg-white/10 text-night-ink shadow-[inset_0_-2px_0_var(--signal)]" : "text-night-muted"
                  }`}
                >
                  {n.label}
                  {badge?.alert && <span className="mono rounded-full bg-bad px-1.5 text-[10px] leading-[16px] text-white">{badge.text}</span>}
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
  const pct = Math.min(100, Math.max(0, summary.overallPct));
  // Petit arc ABJ → YYC : l'avion avance avec le pourcentage du parcours.
  const t = pct / 100;
  const x = (1 - t) * (1 - t) * 8 + 2 * (1 - t) * t * 100 + t * t * 192;
  const y = (1 - t) * (1 - t) * 34 + 2 * (1 - t) * t * -6 + t * t * 34;

  return (
    <Link href="/parcours#apercu" className="group relative mt-5 block shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-night-2 p-3.5 transition-colors hover:border-white/20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "16px 16px" }}
      />
      <div className="relative">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-night-muted uppercase">Parcours</p>
            <p className="font-display text-[30px] leading-none font-extrabold tracking-tight">
              {summary.overallPct}
              <span className="text-[16px] text-signal"> %</span>
            </p>
          </div>
          <IconArrowRight size={14} className="mb-1 text-night-muted transition-transform group-hover:translate-x-0.5 group-hover:text-night-ink" />        </div>

        <svg viewBox="0 0 200 44" className="mt-2 w-full" aria-hidden>
          <path d="M 8 34 Q 100 -6 192 34" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="1.5 5" strokeLinecap="round" />
          <path d="M 8 34 Q 100 -6 192 34" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} />
          <circle cx="8" cy="34" r="3" fill="var(--signal)" />
          <circle cx="192" cy="34" r="3" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
          <circle cx={x} cy={y} r="6" fill="var(--signal)" opacity="0.25" />
          <circle cx={x} cy={y} r="3" fill="var(--signal)" />
          <text x="8" y="43" fill="var(--night-muted)" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle">ABJ</text>
          <text x="192" y="43" fill="var(--night-muted)" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle">YYC</text>
        </svg>

        {summary.nextStep && (
          <div className="mt-2 border-t border-white/10 pt-2.5">
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-signal uppercase">Prochaine étape</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-semibold">{summary.nextStep.title}</p>
            {summary.nextStep.dueLabel && (
              <span
                className={`mono mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                  summary.nextStep.late ? "bg-[#f29a90] text-[#2a0b08]" : "bg-white/10 text-night-ink"
                }`}
              >
                {summary.nextStep.dueLabel}
              </span>
            )}
          </div>
        )}
        {summary.countdown && (
          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2.5">
            <span className="text-[12px] text-night-muted">Profil Entrée express</span>
            <span className={`mono text-[13px] font-semibold ${summary.countdown.late ? "text-[#f29a90]" : "text-night-ink"}`}>{summary.countdown.label}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

type ThemeChoice = "system" | "light" | "dark";
const THEME_ORDER: ThemeChoice[] = ["system", "light", "dark"];
const THEME_LABEL: Record<ThemeChoice, string> = { system: "Thème système", light: "Thème clair", dark: "Thème sombre" };
const THEME_ICON = { system: IconMonitor, light: IconSun, dark: IconMoon } as const;

const themeListeners = new Set<() => void>();

function readTheme(): ThemeChoice {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

function applyTheme(next: ThemeChoice) {
  const root = document.documentElement;
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  document.cookie = next === "system" ? "theme=; path=/; max-age=0; samesite=lax" : `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  themeListeners.forEach((l) => l());
}

function useTheme() {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "system" as ThemeChoice);
}

/** Bouton compact (en-tête mobile) : fait défiler système → clair → sombre. */
function ThemeToggle() {
  const theme = useTheme();
  const Icon = THEME_ICON[theme];
  return (
    <button
      type="button"
      onClick={() => applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(readTheme()) + 1) % THEME_ORDER.length])}
      aria-label={THEME_LABEL[theme]}
      title={THEME_LABEL[theme]}
      className="grid h-8 w-8 place-items-center rounded-lg text-night-muted hover:bg-white/10 hover:text-night-ink"
    >
      <Icon size={17} />
    </button>
  );
}

/** Sélecteur à trois positions (barre latérale). */
function ThemeSegment() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Thème" className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-black/40 p-1">
      {THEME_ORDER.map((t) => {
        const Icon = THEME_ICON[t];
        const on = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={THEME_LABEL[t]}
            title={THEME_LABEL[t]}
            onClick={() => applyTheme(t)}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11.5px] font-semibold transition-colors ${
              on ? "bg-white/15 text-night-ink" : "text-night-muted hover:text-night-ink"
            }`}
          >
            <Icon size={14} />
            {t === "system" ? "Auto" : t === "light" ? "Clair" : "Sombre"}
          </button>
        );
      })}
    </div>
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
      <button type="button" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-night-muted hover:bg-white/10 hover:text-night-ink">
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
