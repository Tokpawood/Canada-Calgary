"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { newId } from "@/lib/ids";
import { ERROR_SKILLS, type ErrorEntry, type Lang } from "@/lib/formation";
import { errorKey, parseCorrections } from "@/lib/errorImport";
import { Segmented } from "@/components/ui";

/**
 * Colle un tableau de corrections (Markdown ou copié d'une page) et l'ajoute au carnet d'un coup.
 * Une faute déjà présente voit son compteur augmenter au lieu d'être recréée.
 */
export function ImportCorrections({
  dossierId,
  errors,
  setErrors,
  defaultExam,
  onClose,
  onDone,
}: {
  dossierId: string;
  errors: ErrorEntry[];
  setErrors: (f: (e: ErrorEntry[]) => ErrorEntry[]) => void;
  defaultExam: Lang;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [exam, setExam] = useState<Lang>(defaultExam);
  const [skill, setSkill] = useState(ERROR_SKILLS[defaultExam][0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseCorrections(text), [text]);
  const existing = useMemo(() => new Map(errors.filter((e) => e.exam === exam).map((e) => [errorKey(e.wrong), e])), [errors, exam]);
  // Doublons dans le collage lui-même : comptés une fois.
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return parsed.filter((p) => {
      const k = errorKey(p.wrong);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [parsed]);
  const repeats = unique.filter((p) => existing.has(errorKey(p.wrong)));
  const fresh = unique.filter((p) => !existing.has(errorKey(p.wrong)));

  async function importAll() {
    if (!unique.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const rows: ErrorEntry[] = fresh.map((p) => ({ id: newId("err"), exam, skill, wrong: p.wrong, correct: p.correct, rule: p.rule, count: 1, mastered: false, createdAt: now }));
    if (rows.length) {
      const { error: err } = await supabase
        .from("training_error")
        .insert(rows.map((r) => ({ id: r.id, dossier_id: dossierId, exam: r.exam, skill: r.skill, wrong: r.wrong, correct: r.correct, rule: r.rule })));
      if (err) {
        setBusy(false);
        setError("L'import n'a pas pu être enregistré. Vérifiez la connexion et réessayez.");
        return;
      }
    }
    // Fautes qui reviennent : compteur +1 et de nouveau « à retravailler ».
    const bumped: ErrorEntry[] = [];
    for (const p of repeats) {
      const e = existing.get(errorKey(p.wrong))!;
      const next = { count: Math.min(999, e.count + 1), mastered: false };
      const { error: err } = await supabase.from("training_error").update({ ...next, updated_at: now }).eq("id", e.id);
      if (!err) bumped.push({ ...e, ...next });
    }
    setErrors((list) => [...rows, ...list.map((e) => bumped.find((b) => b.id === e.id) ?? e)]);
    setBusy(false);
    const parts = [rows.length && `${rows.length} correction${rows.length > 1 ? "s ajoutées" : " ajoutée"}`, bumped.length && `${bumped.length} faute${bumped.length > 1 ? "s déjà notées revenues" : " déjà notée revenue"} (compteur +1)`].filter(Boolean);
    onDone(`${parts.join(", ")} dans le carnet.`);
  }

  return (
    <section className="card flex flex-col gap-3 p-4 sm:p-5">
      <div>
        <p className="text-[15px] font-bold">Coller des corrections</p>
        <p className="text-[12.5px] text-muted">Collez le tableau de votre correcteur : une ligne par faute, colonnes « Vous avez écrit », « Correction » et « Type » (la règle). Le reste du texte est ignoré.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
        <Segmented
          label="Examen des corrections"
          value={exam}
          onChange={(v) => {
            setExam(v);
            setSkill((s) => (ERROR_SKILLS[v].includes(s) ? s : ERROR_SKILLS[v][0]));
          }}
          options={[
            { value: "tcf", label: "TCF" },
            { value: "ielts", label: "IELTS" },
          ]}
        />
        <select id="import-skill" value={skill} onChange={(e) => setSkill(e.target.value)} className="input" aria-label="Épreuve des corrections">
          {ERROR_SKILLS[exam].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <textarea
        id="import-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        className="input mono text-[12.5px]"
        placeholder={"| Vous avez écrit | Correction | Type |\n|---|---|---|\n| en qui concerne | en ce qui concerne | Expression figée |"}
        aria-label="Tableau de corrections à coller"
        autoFocus
      />
      {text.trim() && (
        <div className="rounded-xl bg-surface-2 p-3 text-[13px]" role="status">
          {unique.length === 0 ? (
            <p className="text-bad">Aucune ligne de tableau reconnue. Collez des lignes « faute | correction | règle », ou un tableau copié depuis une page.</p>
          ) : (
            <>
              <p className="font-semibold">
                {unique.length} correction{unique.length > 1 ? "s" : ""} reconnue{unique.length > 1 ? "s" : ""}
                {repeats.length > 0 && <span className="font-normal text-muted"> · dont {repeats.length} déjà dans le carnet (compteur +1)</span>}
              </p>
              <ul className="no-stagger mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
                {unique.map((p, i) => (
                  <li key={i} className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                    <span className="text-bad line-through decoration-bad/40">{p.wrong}</span>
                    <span className="text-ok">{p.correct || "—"}</span>
                    {p.rule && <span className="text-[12px] text-muted sm:col-span-2">{p.rule}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || unique.length === 0} onClick={() => void importAll()}>
          {busy ? "Ajout…" : unique.length ? `Ajouter ${unique.length} correction${unique.length > 1 ? "s" : ""}` : "Ajouter au carnet"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Annuler
        </button>
      </div>
    </section>
  );
}
