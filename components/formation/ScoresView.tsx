"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { newId } from "@/lib/ids";
import { SCORE_PRESETS, SKILLS, TARGET_LEVEL, levels, overallLevel, type Lang, type TrainingScore } from "@/lib/formation";
import { ConfirmButton } from "@/components/ui";
import { IconPlus, IconTrash } from "@/components/icons";
import { fmtDelta, parseScores, scoreDeltas } from "@/lib/formationScores";
import { LangTag, fmtDay } from "./shared";

const LEVEL_NAME: Record<Lang, string> = { tcf: "NCLC", ielts: "CLB" };
const TARGET_TEXT: Record<Lang, string[]> = { tcf: ["549", "549", "16", "16"], ielts: ["8,0", "7,0", "7,0", "7,0"] };

export function ScoresView({
  dossierId,
  scores,
  setScores,
  today,
  canEdit,
}: {
  dossierId: string;
  scores: TrainingScore[];
  setScores: (f: (s: TrainingScore[]) => TrainingScore[]) => void;
  today: string;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {(["tcf", "ielts"] as const).map((exam) => (
        <ExamScores key={exam} exam={exam} dossierId={dossierId} rows={scores.filter((s) => s.exam === exam)} setScores={setScores} today={today} canEdit={canEdit} />
      ))}
      <p className="text-[12.5px] text-muted">
        Sous chaque note : le niveau obtenu et l&apos;écart avec le test précédent. Le niveau retenu est celui de la compétence la plus faible. Correspondances officielles d&apos;IRCC : TCF Canada → NCLC, IELTS General Training → CLB.
      </p>
    </div>
  );
}

function ExamScores({
  exam,
  dossierId,
  rows,
  setScores,
  today,
  canEdit,
}: {
  exam: Lang;
  dossierId: string;
  rows: TrainingScore[];
  setScores: (f: (s: TrainingScore[]) => TrainingScore[]) => void;
  today: string;
  canEdit: boolean;
}) {
  const skills = SKILLS[exam];
  const sorted = [...rows].sort((a, b) => (a.takenOn ?? "9999").localeCompare(b.takenOn ?? "9999"));
  const deltas = scoreDeltas(sorted);
  const used = new Set(rows.map((r) => r.label));
  const next = SCORE_PRESETS[exam].find((p) => !used.has(p.label));
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState(next?.label ?? "");
  const [date, setDate] = useState(today);
  const [vals, setVals] = useState<string[]>(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  function openForm() {
    setLabel(next?.label ?? "");
    setDate(next?.date && next.date <= today ? next.date : today);
    setVals(["", "", "", ""]);
    setError(null);
    setAdding(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseScores(exam, vals);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const nums = parsed.scores;
    setBusy(true);
    setError(null);
    const row: TrainingScore = { id: newId("sc"), exam, label: label.trim() || "Test", takenOn: date || null, scores: nums, notes: "" };
    const { error: err } = await createClient()
      .from("training_score")
      .insert({ id: row.id, dossier_id: dossierId, exam, label: row.label, taken_on: row.takenOn, s1: nums[0], s2: nums[1], s3: nums[2], s4: nums[3] });
    setBusy(false);
    if (err) {
      setError("Enregistrement impossible. Réessayez.");
      return;
    }
    setScores((s) => [...s, row]);
    setAdding(false);
  }

  async function remove(id: string) {
    setListError(null);
    const { error: err } = await createClient().from("training_score").delete().eq("id", id);
    if (err) {
      setListError("Suppression impossible. Vérifiez la connexion et réessayez.");
      return;
    }
    setScores((s) => s.filter((r) => r.id !== id));
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-bold">
            {exam === "tcf" ? "TCF Canada" : "IELTS General Training"} <LangTag lang={exam} />
          </h2>
          <p className="text-[12.5px] text-muted">
            Objectif : {LEVEL_NAME[exam]} {TARGET_LEVEL[exam]} · {exam === "tcf" ? "examen le 15 février 2027" : "examen le 27 mars 2027"}
          </p>
        </div>
        {canEdit && !adding && (
          <button type="button" className="btn btn-primary btn-sm" onClick={openForm}>
            <IconPlus size={15} /> Ajouter un score
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] font-semibold text-muted">
              <th className="px-4 py-2.5 sm:px-5">Test</th>
              {skills.map((s) => (
                <th key={s.id} className="px-2 py-2.5 text-right" title={s.name}>
                  {s.label}
                  <span className="ml-1 font-normal text-faint">/{s.max}</span>
                </th>
              ))}
              <th className="px-2 py-2.5 text-right">Niveau</th>
              {canEdit && (
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line bg-surface-2/60 text-[12.5px] text-muted">
              <td className="px-4 py-2 font-semibold sm:px-5">Cible</td>
              {TARGET_TEXT[exam].map((t, i) => (
                <td key={i} className="mono px-2 py-2 text-right">
                  {t}
                </td>
              ))}
              <td className="mono px-2 py-2 text-right font-semibold">
                {LEVEL_NAME[exam]} {TARGET_LEVEL[exam]}
              </td>
              {canEdit && <td />}
            </tr>
            {sorted.map((r, ri) => {
              const lv = levels(exam, r.scores);
              const ov = overallLevel(exam, r.scores);
              return (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 sm:px-5">
                    <p className="font-semibold">{r.label}</p>
                    {r.takenOn && <p className="text-[11.5px] text-muted">{fmtDay(r.takenOn, { day: "numeric", month: "short", year: "numeric" })}</p>}
                  </td>
                  {r.scores.map((v, i) => {
                    const weak = ov.weakest.includes(i) && v != null;
                    const ok = lv[i] != null && lv[i]! >= TARGET_LEVEL[exam];
                    const d = deltas[ri][i];
                    return (
                      <td key={i} className="px-2 py-2.5 text-right">
                        <span className={`mono font-semibold ${weak ? "text-bad" : ok ? "text-ok" : ""}`}>{v == null ? "—" : String(v).replace(".", ",")}</span>
                        {lv[i] != null && (
                          <span className="block text-[10.5px] text-muted">
                            {LEVEL_NAME[exam]} {lv[i]}
                            {weak ? " · plus faible" : ""}
                          </span>
                        )}
                        {d != null && (
                          <span
                            className={`mono block text-[10.5px] font-semibold ${d > 0 ? "text-ok" : d < 0 ? "text-bad" : "text-faint"}`}
                            title="Écart avec le test précédent"
                          >
                            {fmtDelta(d)}
                            <span className="sr-only"> par rapport au test précédent</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5 text-right">
                    <span className={`mono rounded-md px-1.5 py-0.5 text-[12px] font-bold ${ov.level == null ? "text-muted" : ov.level >= TARGET_LEVEL[exam] ? "bg-ok-bg text-ok" : "bg-opt-bg text-opt"}`}>
                      {ov.level == null ? "—" : `${LEVEL_NAME[exam]} ${ov.level}`}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-2 py-2.5">
                      <ConfirmButton onConfirm={() => remove(r.id)} label={`Supprimer ${r.label}`} className="btn btn-sm btn-ghost px-2 text-bad">
                        <IconTrash size={15} />
                      </ConfirmButton>
                    </td>
                  )}
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-[13px] text-muted sm:px-5">
                  {canEdit ? "Aucun score pour l'instant. Ajoutez une ligne après chaque test (diagnostic, examen blanc, examen officiel)." : "Aucun score enregistré pour l'instant."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {listError && (
        <p role="alert" className="mx-4 my-3 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad sm:mx-5">
          {listError}
        </p>
      )}

      {canEdit && adding && (
        <form onSubmit={save} className="border-t border-line bg-surface-2/50 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <label className="col-span-2 sm:col-span-1 lg:col-span-1">
              <span className="field-label">Test</span>
              <input list={`presets-${exam}`} value={label} onChange={(e) => setLabel(e.target.value)} className="input" required />
              <datalist id={`presets-${exam}`}>
                {SCORE_PRESETS[exam].map((p) => (
                  <option key={p.label} value={p.label} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="field-label">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
            {skills.map((s, i) => (
              <label key={s.id}>
                <span className="field-label">
                  {s.label} <span className="text-faint">/{s.max}</span>
                </span>
                <input
                  inputMode="decimal"
                  value={vals[i]}
                  onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                  className="input mono"
                  placeholder={exam === "ielts" ? "7,0" : s.max === 20 ? "16" : "549"}
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
