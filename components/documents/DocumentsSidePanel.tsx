"use client";

import type { Gap, Identity } from "@/lib/types";
import { fmtShortDate } from "@/components/ui";
import { IconCheck, IconInfo, IconShield } from "@/components/icons";
import { CopyButton } from "@/components/profil/FieldGrid";

const IDENTITY_FIELDS: Array<[keyof Identity, string]> = [
  ["nom", "Nom"],
  ["prenoms", "Prénoms"],
  ["naissance", "Naissance"],
  ["lieu", "Lieu de naissance"],
  ["pere", "Père"],
  ["mere", "Mère"],
];

/** Identité de référence, écarts à corriger et règles de forme (onglet « Identité & écarts » de Documents). */
export function DocumentsSidePanel({
  identity,
  gaps,
  onToggleGap,
}: {
  identity: Identity | null;
  gaps: Gap[];
  onToggleGap: (id: string, done: boolean) => void;
}) {
  const open = gaps.filter((g) => !g.done).length;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="card overflow-hidden xl:row-span-2">
        <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-act-soft text-act">
            <IconShield size={17} />
          </span>
          <div>
            <h2 className="text-[16px] font-bold">Identité de référence</h2>
            <p className="text-[12.5px] text-muted">
              Chaque document doit reprendre ces informations lettre pour
              lettre.
            </p>
          </div>
        </div>
        <dl className="mt-2 divide-y divide-line px-4 pb-2 sm:px-5">
          {IDENTITY_FIELDS.map(([key, label]) => {
            const raw = identity?.[key] as string | null | undefined;
            const value = key === "naissance" ? fmtShortDate(raw) : raw;
            return (
              <div
                key={key}
                className="group grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-3"
              >
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="m-0 flex min-w-0 items-center gap-2">
                  <span
                    className={`min-w-0 text-[14px] font-semibold break-words ${value ? "" : "text-bad"}`}
                  >
                    {value || "manquant"}
                  </span>
                  {value && <CopyButton text={String(value)} label={label} />}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold">Écarts à corriger</h2>
          {gaps.length > 0 && (
            <span
              className={`mono rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${open ? "bg-opt-bg text-opt" : "bg-ok-bg text-ok"}`}
            >
              {open ? `${open} ouvert(s)` : "tout corrigé"}
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-muted">
          Différences repérées entre vos pièces ; cochez quand c&apos;est réglé.
        </p>
        {gaps.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">Aucun écart signalé.</p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {gaps.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={g.done}
                  onClick={() => onToggleGap(g.id, !g.done)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                >
                  <span
                    className={`mt-0.5 grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] border-2 ${g.done ? "border-ok bg-ok text-surface" : "border-line text-transparent"}`}
                  >
                    <IconCheck size={10} strokeWidth={3.2} />
                  </span>
                  <span
                    className={`text-[13.5px] leading-snug ${g.done ? "text-faint line-through" : ""}`}
                  >
                    {g.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="self-start rounded-2xl border border-dashed border-line p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <IconInfo size={15} className="text-muted" />
          <h2 className="text-[14px] font-bold">Règles de forme</h2>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] text-muted">
          <li>
            Nom et prénoms identiques, lettre pour lettre, sur tous les
            documents.
          </li>
          <li>
            Dates au format AAAA-MM-JJ (ou AAAA-MM si le jour est inconnu).
          </li>
          <li>Seuls les liens en https:// sont acceptés.</li>
          <li>Scans en PDF, JPEG, PNG ou WEBP, 20 Mo maximum.</li>
        </ul>
      </section>
    </div>
  );
}
