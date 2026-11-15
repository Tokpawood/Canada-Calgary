"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { newId } from "@/lib/ids";
import { ERROR_REPEAT_THRESHOLD, ERROR_SKILLS, type ErrorEntry, type Lang } from "@/lib/formation";
import { ConfirmButton, EmptyState, Segmented } from "@/components/ui";
import { IconAlert, IconCheck, IconPencil, IconPlus, IconSearch, IconTrash } from "@/components/icons";
import { LangTag, fmtDay } from "./shared";

type Filter = "aretravailler" | "cibles" | "maitrisees" | "toutes";

interface Draft {
  exam: Lang;
  skill: string;
  wrong: string;
  correct: string;
  rule: string;
}

const emptyDraft = (exam: Lang): Draft => ({ exam, skill: ERROR_SKILLS[exam][0], wrong: "", correct: "", rule: "" });

export function ErrorsView({
  dossierId,
  errors,
  setErrors,
  defaultExam,
  canEdit,
}: {
  dossierId: string;
  errors: ErrorEntry[];
  setErrors: (f: (e: ErrorEntry[]) => ErrorEntry[]) => void;
  defaultExam: Lang;
  canEdit: boolean;
}) {
  const [exam, setExam] = useState<Lang | "all">("all");
  const [filter, setFilter] = useState<Filter>("aretravailler");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultExam));
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);

  // « Modifier » sur une erreur en bas de liste : le formulaire (en haut) revient à l'écran.
  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [formOpen, editing]);

  const counts = useMemo(() => {
    const scope = errors.filter((e) => exam === "all" || e.exam === exam);
    return {
      aretravailler: scope.filter((e) => !e.mastered).length,
      cibles: scope.filter((e) => !e.mastered && e.count >= ERROR_REPEAT_THRESHOLD).length,
      maitrisees: scope.filter((e) => e.mastered).length,
      toutes: scope.length,
    };
  }, [errors, exam]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return errors
      .filter((e) => exam === "all" || e.exam === exam)
      .filter((e) => (filter === "toutes" ? true : filter === "maitrisees" ? e.mastered : filter === "cibles" ? !e.mastered && e.count >= ERROR_REPEAT_THRESHOLD : !e.mastered))
      .filter((e) => !needle || [e.wrong, e.correct, e.rule, e.skill].some((t) => t.toLowerCase().includes(needle)))
      .sort((a, b) => Number(a.mastered) - Number(b.mastered) || b.count - a.count || b.createdAt.localeCompare(a.createdAt));
  }, [errors, exam, filter, q]);

  function openNew() {
    setEditing(null);
    setDraft(emptyDraft(exam === "all" ? defaultExam : exam));
    setError(null);
    setFormOpen(true);
  }

  function openEdit(e: ErrorEntry) {
    setEditing(e.id);
    setDraft({ exam: e.exam, skill: e.skill, wrong: e.wrong, correct: e.correct, rule: e.rule });
    setError(null);
    setFormOpen(true);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const d = { ...draft, wrong: draft.wrong.trim(), correct: draft.correct.trim(), rule: draft.rule.trim() };
    if (!d.wrong) {
      setError("Saisissez au moins la phrase fautive.");
      return;
    }
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    if (editing) {
      const { error: err } = await supabase
        .from("training_error")
        .update({ exam: d.exam, skill: d.skill, wrong: d.wrong, correct: d.correct, rule: d.rule, updated_at: now })
        .eq("id", editing);
      setBusy(false);
      if (err) return setError("Enregistrement impossible. Réessayez.");
      setErrors((list) => list.map((e) => (e.id === editing ? { ...e, ...d } : e)));
    } else {
      const row: ErrorEntry = { id: newId("err"), ...d, count: 1, mastered: false, createdAt: now };
      const { error: err } = await supabase
        .from("training_error")
        .insert({ id: row.id, dossier_id: dossierId, exam: d.exam, skill: d.skill, wrong: d.wrong, correct: d.correct, rule: d.rule });
      setBusy(false);
      if (err) return setError("Enregistrement impossible. Réessayez.");
      setErrors((list) => [row, ...list]);
    }
    setFormOpen(false);
    setEditing(null);
  }

  // Écritures enchaînées par erreur : deux touches rapides sur « + » arrivent en base dans l'ordre.
  const queues = useRef(new Map<string, Promise<void>>());
  // Dernières valeurs confirmées par la base, pour revenir en arrière proprement en cas d'échec.
  const saved = useRef(new Map<string, Pick<ErrorEntry, "count" | "mastered">>());

  function patch(id: string, p: Partial<Pick<ErrorEntry, "count" | "mastered">>) {
    const before = errors.find((e) => e.id === id);
    if (!before) return;
    setListError(null);
    if (!queues.current.has(id)) saved.current.set(id, { count: before.count, mastered: before.mastered });
    setErrors((list) => list.map((e) => (e.id === id ? { ...e, ...p } : e)));
    const write = async () => {
      const { error: err } = await supabase.from("training_error").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
      const last = queues.current.get(id) === next;
      if (err) setListError("La modification n'a pas pu être enregistrée. Vérifiez la connexion et réessayez.");
      else saved.current.set(id, { ...saved.current.get(id)!, ...p });
      if (!last) return;
      // Dernière écriture en attente : en cas d'échec, l'affichage revient à ce que contient la base.
      const db = saved.current.get(id)!;
      if (err) setErrors((list) => list.map((e) => (e.id === id ? { ...e, ...db } : e)));
      queues.current.delete(id);
      saved.current.delete(id);
    };
    const next: Promise<void> = (queues.current.get(id) ?? Promise.resolve()).then(write, write);
    queues.current.set(id, next);
  }

  async function remove(id: string) {
    setListError(null);
    const { error: err } = await supabase.from("training_error").delete().eq("id", id);
    if (err) {
      setListError("Suppression impossible. Vérifiez la connexion et réessayez.");
      return;
    }
    setErrors((list) => list.filter((e) => e.id !== id));
    if (editing === id) {
      setFormOpen(false);
      setEditing(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Examen"
          value={exam}
          onChange={setExam}
          options={[
            { value: "all", label: "Tous" },
            { value: "tcf", label: "TCF", count: errors.filter((e) => e.exam === "tcf").length },
            { value: "ielts", label: "IELTS", count: errors.filter((e) => e.exam === "ielts").length },
          ]}
        />
        <Segmented
          label="Filtre"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "aretravailler", label: "À retravailler", count: counts.aretravailler },
            { value: "cibles", label: `Revenues ${ERROR_REPEAT_THRESHOLD} fois et +`, count: counts.cibles },
            { value: "maitrisees", label: "Maîtrisées", count: counts.maitrisees },
            { value: "toutes", label: "Toutes", count: counts.toutes },
          ]}
        />
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <IconSearch size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher dans le carnet" className="input w-full pl-9 sm:w-[200px]" type="search" />
          </label>
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={openNew}>
              <IconPlus size={16} /> Erreur
            </button>
          )}
        </div>
      </div>

      {counts.cibles > 0 && filter !== "cibles" && (
        <button
          type="button"
          onClick={() => setFilter("cibles")}
          className="flex items-center gap-2 rounded-xl bg-opt-bg px-4 py-3 text-left text-[13px] text-opt"
        >
          <IconAlert size={16} className="shrink-0" />
          <span>
            <strong>{counts.cibles}</strong> erreur{counts.cibles > 1 ? "s sont revenues" : " est revenue"} {ERROR_REPEAT_THRESHOLD} fois ou plus : à transformer en exercice ciblé la semaine
            prochaine.
          </span>
        </button>
      )}

      {listError && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
          {listError}
        </p>
      )}

      {formOpen && (
        <form ref={formRef} onSubmit={save} className="card flex scroll-mt-24 flex-col gap-3 p-4 sm:p-5">
          <p className="text-[15px] font-bold">{editing ? "Modifier l'erreur" : "Nouvelle erreur"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            <Segmented
              label="Examen de l'erreur"
              value={draft.exam}
              onChange={(v) => setDraft((d) => ({ ...d, exam: v, skill: ERROR_SKILLS[v].includes(d.skill) ? d.skill : ERROR_SKILLS[v][0] }))}
              options={[
                { value: "tcf", label: "TCF" },
                { value: "ielts", label: "IELTS" },
              ]}
            />
            <select value={draft.skill} onChange={(e) => setDraft((d) => ({ ...d, skill: e.target.value }))} className="input" aria-label="Épreuve">
              {ERROR_SKILLS[draft.exam].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <label>
            <span className="field-label">Phrase fautive</span>
            <textarea value={draft.wrong} onChange={(e) => setDraft((d) => ({ ...d, wrong: e.target.value }))} rows={2} className="input" required autoFocus />
          </label>
          <label>
            <span className="field-label">Phrase corrigée</span>
            <textarea value={draft.correct} onChange={(e) => setDraft((d) => ({ ...d, correct: e.target.value }))} rows={2} className="input" />
          </label>
          <label>
            <span className="field-label">Règle</span>
            <textarea value={draft.rule} onChange={(e) => setDraft((d) => ({ ...d, rule: e.target.value }))} rows={2} className="input" placeholder="Ex. : « bien que » est toujours suivi du subjonctif" />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {!shown.length ? (
        <EmptyState icon={<IconPencil size={20} />} title={errors.length ? "Aucune erreur dans ce filtre" : "Carnet vide"}>
          {errors.length
            ? q.trim()
              ? `Aucun résultat pour « ${q.trim()} » : changez de recherche ou de filtre.`
              : "Changez de filtre ou d'examen."
            : "Après chaque correction, notez ici la phrase fautive, la phrase corrigée et la règle. Relisez le carnet chaque dimanche."}
        </EmptyState>
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {shown.map((e) => {
            const target = !e.mastered && e.count >= ERROR_REPEAT_THRESHOLD;
            return (
              <li key={e.id} className={`card p-4 sm:p-5 ${target ? "ring-2 ring-opt/50" : ""} ${e.mastered ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  <LangTag lang={e.exam} />
                  <span className="font-semibold">{e.skill}</span>
                  <span>· {fmtDay(e.createdAt.slice(0, 10), { day: "numeric", month: "short" })}</span>
                  {target && <span className="rounded-full bg-opt-bg px-2 py-px font-bold text-opt">Exercice ciblé</span>}
                  {e.mastered && (
                    <span className="flex items-center gap-1 rounded-full bg-ok-bg px-2 py-px font-bold text-ok">
                      <IconCheck size={12} strokeWidth={3} /> Maîtrisée
                    </span>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-2 text-[14px] lg:grid-cols-3">
                  <p className="rounded-lg bg-bad-bg/60 px-3 py-2">
                    <span className="block text-[11px] font-semibold text-bad">Fautif</span>
                    <span className="line-through decoration-bad/60">{e.wrong}</span>
                  </p>
                  <p className="rounded-lg bg-ok-bg/60 px-3 py-2">
                    <span className="block text-[11px] font-semibold text-ok">Corrigé</span>
                    {e.correct || <span className="text-faint">—</span>}
                  </p>
                  <p className="rounded-lg bg-surface-2 px-3 py-2">
                    <span className="block text-[11px] font-semibold text-muted">Règle</span>
                    {e.rule || <span className="text-faint">—</span>}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center rounded-lg border border-line">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center text-[16px] font-bold text-muted hover:text-ink disabled:opacity-40"
                      disabled={!canEdit || e.count <= 1}
                      onClick={() => patch(e.id, { count: e.count - 1 })}
                      aria-label="Une répétition de moins"
                    >
                      −
                    </button>
                    <span className="mono min-w-[88px] px-1 text-center text-[12.5px]">
                      <strong className={target ? "text-opt" : ""}>{e.count}</strong> fois
                    </span>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center text-[16px] font-bold text-muted hover:text-ink disabled:opacity-40"
                      disabled={!canEdit}
                      onClick={() => patch(e.id, { count: e.count + 1 })}
                      aria-label="Erreur refaite : une répétition de plus"
                    >
                      +
                    </button>
                  </span>
                  {canEdit && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(e.id, { mastered: !e.mastered })}>
                        <IconCheck size={14} /> {e.mastered ? "À retravailler" : "Maîtrisée"}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>
                        <IconPencil size={14} /> Modifier
                      </button>
                      <ConfirmButton onConfirm={() => remove(e.id)} label="Supprimer l'erreur" className="btn btn-ghost btn-sm ml-auto text-bad">
                        <IconTrash size={14} />
                      </ConfirmButton>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
