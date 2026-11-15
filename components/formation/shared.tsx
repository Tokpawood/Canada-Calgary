"use client";

import type { Lang } from "@/lib/formation";
import { IconCheck } from "@/components/icons";

export const LANG_LABEL: Record<Lang, string> = { tcf: "TCF", ielts: "IELTS" };

/** TCF en ambre, IELTS en encre inversée : lisible sans dépendre de la couleur seule (le libellé est toujours affiché). */
export function LangTag({ lang, className = "" }: { lang: Lang; className?: string }) {
  return (
    <span
      className={`mono inline-flex shrink-0 items-center rounded-md px-1.5 py-px text-[10.5px] font-semibold tracking-wide ${
        lang === "tcf" ? "bg-opt-bg text-opt" : "bg-act text-act-ink"
      } ${className}`}
    >
      {LANG_LABEL[lang]}
    </span>
  );
}

export function CheckBox({ checked, onChange, label, size = 22, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; size?: number; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-[7px] border-2 transition-colors disabled:opacity-50 ${
        checked ? "border-ok bg-ok text-surface" : "border-line text-transparent enabled:hover:border-ok"
      }`}
    >
      <span className="grid place-items-center">{checked && <IconCheck size={Math.round(size * 0.6)} strokeWidth={3.2} />}</span>
    </button>
  );
}

export function fmtDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", ...opts });
}

export function fmtRange(from: string, to: string): string {
  const a = fmtDay(from, { day: "numeric", month: "short" });
  const b = fmtDay(to, { day: "numeric", month: "short" });
  return `${a} – ${b}`;
}

export function minutesLabel(m: number | null): string {
  if (m == null) return "";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}
