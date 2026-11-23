"use client";

import { useMemo } from "react";
import { ageAt, workMonths } from "@/lib/rules";
import { crsCalc, crsFromProfile, crsScenarios } from "@/lib/crs";
import type { FswProfile, HistoryEntry } from "@/lib/types";
import { IconExternal } from "@/components/icons";

const ROUNDS_URL =
  "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express/soumettre-profil/tours-invitations.html";

interface Props {
  fsw: FswProfile;
  naissance: string | null;
  profileDate: string | null;
  history: HistoryEntry[];
  /** NCLC estimé par épreuve d'après les tests TCF de la Formation. */
  tcfNclc?: Partial<Record<"co" | "ce" | "ee" | "eo", number>>;
}

const TCF_ORDER: Array<["co" | "ce" | "eo" | "ee", string]> = [
  ["co", "CO"],
  ["ce", "CE"],
  ["eo", "EO"],
  ["ee", "EE"],
];

/** Score de classement global : ce qui décide de l'invitation, avec scénarios selon le niveau visé au TCF. */
export function CrsCard({
  fsw,
  naissance,
  profileDate,
  history,
  tcfNclc = {},
}: Props) {
  const { input, r, known, eduAssumed, years, age, scenarios } = useMemo(() => {
    const age = ageAt(naissance, profileDate);
    const years = Math.floor(workMonths(history, profileDate) / 12);
    const eduAssumed = !fsw.edu;
    const input = { ...crsFromProfile(fsw, age, years), edu: fsw.edu || "p3" };
    const known = input.fr.every((n) => n > 0) || input.en.every((n) => n > 0);
    return {
      input,
      r: crsCalc(input),
      known,
      eduAssumed,
      years,
      age,
      scenarios: crsScenarios(input),
    };
  }, [fsw, naissance, profileDate, history]);

  const parts: Array<[string, number, number]> = [
    ["Âge", r.age, 110],
    ["Études", r.edu, 150],
    ["1ʳᵉ langue", r.lang1, 136],
    ["2ᵉ langue", r.lang2, 24],
    ["Transférabilité", r.transfer, 100],
    ["Bonus français", r.french, 50],
  ];
  const EN = ["aucun test", "NCLC 5", "NCLC 7", "NCLC 9"];

  return (
    <section className="card p-5 sm:p-6">
      <h3 className="text-[16px] font-bold">
        Score de classement global (CRS)
      </h3>
      <p className="text-[12.5px] text-muted">
        La grille ci-dessus vérifie l&apos;admissibilité ; c&apos;est ce score,
        sur 1 200, qui décide de l&apos;invitation. Estimation pour un candidat
        seul{age != null ? `, ${age} ans à la date du profil` : ""}, {years} an
        {years > 1 ? "s" : ""} d&apos;expérience à l&apos;étranger
        {eduAssumed
          ? ", études supposées : baccalauréat (à confirmer par WES)"
          : ""}
        .
      </p>

      <div className="mt-4 grid gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
        <div>
          <p className="eyebrow">
            {known ? "Avec vos scores saisis" : "Scores de langue à saisir"}
          </p>
          <p className="mono text-[44px] leading-none font-bold">
            {known ? r.total : "—"}
          </p>
          <p className="mt-1 text-[12px] text-muted">sur 1 200</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {parts.map(([label, v, max]) => (
            <li key={label} className="rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-[11.5px] text-muted">{label}</p>
              <p className="mono text-[15px] font-semibold">
                {known ? v : "—"}
                <span className="text-[11px] font-normal text-muted">
                  {" "}
                  / {max}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {TCF_ORDER.some(([e]) => tcfNclc[e]) && (
        <div className="mt-5 rounded-xl border border-line px-4 py-3 text-[12.5px]">
          <p className="font-semibold">
            Votre niveau actuel d&apos;après les tests TCF de la Formation
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {TCF_ORDER.map(([e, label]) => (
              <span
                key={e}
                className="mono rounded-full bg-surface-2 px-2 py-0.5"
              >
                {label} {tcfNclc[e] ? `NCLC ${tcfNclc[e]}` : "à tester"}
              </span>
            ))}
          </p>
          {TCF_ORDER.every(([e]) => tcfNclc[e]) ? (
            <p className="mt-1.5 text-muted">
              À ce niveau, sans anglais :{" "}
              <strong className="mono text-ink">
                {
                  crsCalc({
                    ...input,
                    fr: TCF_ORDER.map(([e]) => tcfNclc[e]!) as [
                      number,
                      number,
                      number,
                      number,
                    ],
                    en: [0, 0, 0, 0],
                  }).total
                }
              </strong>{" "}
              points ; avec NCLC 5 en anglais :{" "}
              <strong className="mono text-ink">
                {
                  crsCalc({
                    ...input,
                    fr: TCF_ORDER.map(([e]) => tcfNclc[e]!) as [
                      number,
                      number,
                      number,
                      number,
                    ],
                    en: [5, 5, 5, 5],
                  }).total
                }
              </strong>
              .
            </p>
          ) : (
            <p className="mt-1.5 text-muted">
              Faites les 4 épreuves en test pour obtenir une estimation du CRS à
              votre niveau actuel.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[440px] text-[13px]">
          <caption className="mb-2 text-left text-[12.5px] text-muted">
            Score selon le niveau NCLC atteint dans les 4 épreuves, en français
            (TCF Canada) et en anglais (IELTS).
          </caption>
          <thead>
            <tr className="text-left text-[11.5px] text-muted">
              <th className="py-1.5 pr-3 font-semibold">Français</th>
              {EN.map((e) => (
                <th key={e} className="py-1.5 pr-3 text-right font-semibold">
                  Anglais : {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((row) => (
              <tr
                key={row.fr}
                className={`border-t border-line ${row.fr === 10 ? "bg-signal/10" : ""}`}
              >
                <th className="py-2 pr-3 text-left font-semibold">
                  NCLC {row.fr}
                  {row.fr === 10 ? (
                    <span className="ml-1.5 text-[11px] font-normal text-muted">
                      objectif de la formation
                    </span>
                  ) : null}
                </th>
                {row.cells.map((c) => (
                  <td key={c.en} className="mono py-2 pr-3 text-right">
                    {c.total}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-1.5 text-[12.5px] text-muted">
        <li>
          • NCLC 7 dans les 4 épreuves de français donne{" "}
          <strong className="text-ink">25 points</strong> de plus, et{" "}
          <strong className="text-ink">50</strong> avec au moins NCLC 5 partout
          en anglais : l&apos;IELTS vaut donc la peine même à un niveau moyen.
        </li>
        <li>
          • Passer de NCLC 9 à 10 dans toutes les épreuves ajoute{" "}
          {crsCalc({ ...input, fr: [10, 10, 10, 10], en: [5, 5, 5, 5] }).total -
            crsCalc({ ...input, fr: [9, 9, 9, 9], en: [5, 5, 5, 5] })
              .total}{" "}
          points (avec NCLC 5 en anglais).
        </li>
        <li>
          • Ce niveau en français ouvre aussi les tirages réservés aux
          francophones, dont les seuils sont souvent bien plus bas que ceux des
          tirages généraux.{" "}
          <a
            href={ROUNDS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-semibold text-ink underline"
          >
            Voir les derniers tirages <IconExternal size={12} />
          </a>
        </li>
      </ul>
    </section>
  );
}
