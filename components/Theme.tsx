"use client";

import { useSyncExternalStore } from "react";
import { IconMonitor, IconMoon, IconSun } from "./icons";

/** Thème clair / sombre / système, mémorisé dans un cookie (lu côté serveur pour éviter le flash). */
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

export function applyTheme(next: ThemeChoice) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  window.setTimeout(() => root.classList.remove("theme-switching"), 450);
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  document.cookie = next === "system" ? "theme=; path=/; max-age=0; samesite=lax" : `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  themeListeners.forEach((l) => l());
}

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "system" as ThemeChoice);
}

/** Bouton compact (en-tête mobile) : fait défiler système → clair → sombre. */
export function ThemeToggle() {
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
export function ThemeSegment() {
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
