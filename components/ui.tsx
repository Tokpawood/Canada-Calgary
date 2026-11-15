"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DocumentStatus, StepStatus } from "@/lib/types";
import { daysUntil, parseD } from "@/lib/rules";
import { IconX } from "./icons";

export type Tone = "ok" | "run" | "bad" | "opt" | "todo" | "act";

export const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  run: "bg-run-bg text-run",
  bad: "bg-bad-bg text-bad",
  opt: "bg-opt-bg text-opt",
  todo: "bg-todo-bg text-todo",
  act: "bg-act-soft text-act",
};

export const TONE_DOT: Record<Tone, string> = {
  ok: "bg-ok",
  run: "bg-run",
  bad: "bg-bad",
  opt: "bg-opt",
  todo: "bg-todo",
  act: "bg-act",
};

export const STEP_TONE: Record<StepStatus, Tone> = {
  "À faire": "todo",
  "En cours": "run",
  Bloqué: "bad",
  Fait: "ok",
  "Si nécessaire": "opt",
};

export const DOC_TONE: Record<DocumentStatus, Tone> = {
  "À obtenir": "todo",
  Demandé: "run",
  Obtenu: "ok",
};

export function Chip({ tone, children, dot, className = "" }: { tone: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`chip ${TONE_CLASS[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />}
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar inline-flex max-w-full min-w-0 gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              active ? "bg-act text-act-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {o.label}
            {o.count != null && (
              <span className={`mono rounded-md px-1 text-[11px] ${active ? "bg-white/20" : "bg-surface-2 text-faint"}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Jauge fine à une seule teinte, extrémité arrondie, repères optionnels (ex. minimum exigé). */
export function Meter({
  value,
  tone = "act",
  markers = [],
  height = 6,
  label,
  className = "",
}: {
  value: number;
  tone?: Tone;
  markers?: Array<{ pct: number; label: string }>;
  height?: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={`relative rounded-full bg-surface-2 ${className}`}
      style={{ height }}
    >
      <span className={`bar-grow block h-full rounded-full ${TONE_DOT[tone]} transition-[width] duration-500`} style={{ width: `${pct}%`, minWidth: pct > 0 ? height : 0 }} />
      {markers.map((m) => (
        <span
          key={m.label}
          title={m.label}
          className="absolute top-1/2 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-surface"
          style={{ left: `${Math.min(100, Math.max(0, m.pct))}%`, height: height + 8 }}
        />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-act-soft text-act">{icon}</div>}
      <p className="font-display text-base font-bold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-faint">{hint}</span>}
    </label>
  );
}

/** Bouton de suppression en deux temps : le premier clic arme, le second confirme. Se désarme après 6 s. */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Confirmer",
  className = "btn btn-sm btn-danger",
  children,
}: {
  /** Peut renvoyer une promesse : le bouton reste désactivé jusqu'à la fin (pas de double suppression). */
  onConfirm: () => void | Promise<unknown>;
  label: string;
  confirmLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      data-armed={armed}
      disabled={busy}
      aria-busy={busy || undefined}
      aria-label={busy ? "En cours…" : armed ? confirmLabel : label}
      onClick={(e) => {
        e.stopPropagation();
        if (busy) return;
        if (armed) {
          setArmed(false);
          const result = onConfirm();
          if (result instanceof Promise) {
            setBusy(true);
            void result.finally(() => setBusy(false));
          }
        } else setArmed(true);
      }}
      className={`${className} disabled:opacity-60`}
    >
      {busy ? "En cours…" : armed ? confirmLabel : (children ?? label)}
    </button>
  );
}

const noopSubscribe = () => () => {};

export function Drawer({
  onClose,
  children,
  footer,
  label,
  header,
  tabs,
  topActions,
}: {
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  label: string;
  /** En-tête sombre (titre, statut, chiffres clés), dans le style des pages. */
  header?: ReactNode;
  /** Onglets affichés en bas de l'en-tête sombre. */
  tabs?: ReactNode;
  /** Boutons à côté de « Fermer » (ex. précédente / suivante). */
  topActions?: ReactNode;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("locked");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("locked");
    };
  }, [onClose]);

  // Accessibilité : le focus entre dans le panneau, y reste avec Tab, puis revient là où il était à la fermeture.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    }, 0);
    const onTab = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onTab);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  // Rendu directement dans <body> : un ancêtre animé (transform) ne doit pas enfermer le tiroir dans la zone de contenu.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[3px]" onClick={onClose}>
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`anim-drawer flex h-full w-full flex-col bg-surface shadow-2xl outline-none ${header ? "max-w-[560px] bg-bg lg:max-w-[600px]" : "max-w-[480px]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {header ? (
          <>
            <div className="relative shrink-0 overflow-hidden bg-night text-night-ink" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "20px 20px" }}
              />
              <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-signal opacity-[0.07] blur-3xl" />
              <div className="absolute right-3.5 z-10 flex items-center gap-1" style={{ top: "calc(0.875rem + env(safe-area-inset-top, 0px))" }}>
                {topActions}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="grid h-8 w-8 place-items-center rounded-lg text-night-muted hover:bg-white/10 hover:text-night-ink"
                >
                  <IconX size={18} />
                </button>
              </div>
              <div className="anim-rise relative px-5 pt-5 pb-4 [animation-delay:120ms] sm:px-6">{header}</div>
              {tabs && <div className="relative border-t border-white/10 pt-1.5 [&>div]:px-3 sm:[&>div]:px-4">{tabs}</div>}
            </div>
            <div className="stagger min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 sm:px-6" style={{ paddingBottom: footer ? "2rem" : "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
              {children}
            </div>
          </>
        ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 sm:px-6" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
            className="absolute right-4 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            <IconX size={18} />
          </button>
          {children}
        </div>
        )}
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

export function DrawerSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="eyebrow">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function fcfa(n: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0));
}

export function fmtShortDate(iso: string | null | undefined): string {
  const d = parseD(iso);
  if (!d) return iso ?? "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Échéance relative lisible + ton associé (retard, imminent, proche, lointain). */
export function dueInfo(due: string | null, open: boolean): { text: string; tone: Tone } | null {
  const d = daysUntil(due);
  if (d === null) return null;
  if (!open) return { text: fmtShortDate(due), tone: "todo" };
  if (d < 0) return { text: `en retard · ${-d} j`, tone: "bad" };
  if (d === 0) return { text: "aujourd'hui", tone: "opt" };
  if (d === 1) return { text: "demain", tone: "opt" };
  if (d <= 7) return { text: `dans ${d} j`, tone: "opt" };
  if (d <= 30) return { text: `dans ${d} j`, tone: "run" };
  return { text: fmtShortDate(due), tone: "todo" };
}
