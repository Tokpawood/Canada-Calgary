"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { newId } from "@/lib/ids";
import type { Lang, MemoEntry } from "@/lib/formation";
import { guessTitle, parseMarkdown } from "@/lib/miniMarkdown";
import { ConfirmButton, EmptyState, Segmented } from "@/components/ui";
import { IconBook, IconChevronDown, IconPencil, IconPlus, IconPrinter, IconSearch, IconTrash } from "@/components/icons";
import { LangTag, fmtDay } from "./shared";
import { Markdown } from "./Markdown";

interface Draft {
  exam: Lang;
  title: string;
  body: string;
}

function MemoCard({
  memo,
  open,
  onToggle,
  canEdit,
  onEdit,
  onDelete,
}: {
  memo: MemoEntry;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const blocks = useMemo(() => (open ? parseMarkdown(memo.body) : []), [memo.body, open]);
  const sections = blocks.filter((b) => b.t === "h" && b.level === 2) as Extract<(typeof blocks)[number], { t: "h" }>[];
  return (
    <article className="card overflow-hidden print:shadow-none">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5 print:hidden">
        <LangTag lang={memo.exam} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{memo.title}</span>
          <span className="block text-[12px] text-muted">Ajoutée le {fmtDay(memo.createdAt.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}</span>
        </span>
        <IconChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line px-4 pt-4 pb-5 sm:px-6">
          <h2 className="mb-3 hidden text-[18px] font-bold print:block">{memo.title}</h2>
          {sections.length > 2 && (
            <nav aria-label="Sections de la leçon" className="mb-4 flex flex-wrap gap-1.5 print:hidden">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium hover:bg-act-soft hover:text-act">
                  {s.text}
                </a>
              ))}
            </nav>
          )}
          <Markdown blocks={blocks} skipFirstH1 />
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 print:hidden">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              <IconPrinter size={15} /> Imprimer
            </button>
            {canEdit && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
                  <IconPencil size={15} /> Modifier
                </button>
                <ConfirmButton label="Supprimer la leçon" confirmLabel="Supprimer définitivement" onConfirm={onDelete}>
                  <IconTrash size={15} /> Supprimer
                </ConfirmButton>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function MemoView({
  dossierId,
  memos,
  setMemos,
  defaultExam,
  canEdit,
}: {
  dossierId: string;
  memos: MemoEntry[];
  setMemos: (f: (m: MemoEntry[]) => MemoEntry[]) => void;
  defaultExam: Lang;
  canEdit: boolean;
}) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(memos[0]?.id ?? null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return memos.filter((m) => !n || m.title.toLowerCase().includes(n) || m.body.toLowerCase().includes(n));
  }, [memos, q]);
  const previewBlocks = useMemo(() => (draft && preview ? parseMarkdown(draft.body) : []), [draft, preview]);

  function openNew() {
    setEditing(null);
    setDraft({ exam: defaultExam, title: "", body: "" });
    setPreview(false);
    setError(null);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!draft) return;
    const body = draft.body.trim();
    const title = (draft.title.trim() || guessTitle(body)).slice(0, 200);
    if (!body || !title) return setError("Collez le texte de la leçon.");
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    if (editing) {
      const { error: err } = await supabase.from("training_memo").update({ exam: draft.exam, title, body, updated_at: now }).eq("id", editing);
      setBusy(false);
      if (err) return setError("Enregistrement impossible. Réessayez.");
      setMemos((list) => list.map((m) => (m.id === editing ? { ...m, exam: draft.exam, title, body } : m)));
      setOpenId(editing);
    } else {
      const row: MemoEntry = { id: newId("memo"), exam: draft.exam, title, body, createdAt: now };
      const { error: err } = await supabase.from("training_memo").insert({ id: row.id, dossier_id: dossierId, exam: row.exam, title, body });
      setBusy(false);
      if (err) return setError("Enregistrement impossible. Réessayez.");
      setMemos((list) => [row, ...list]);
      setOpenId(row.id);
    }
    setDraft(null);
    setEditing(null);
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from("training_memo").delete().eq("id", id);
    if (err) {
      setError("Suppression impossible. Vérifiez la connexion et réessayez.");
      return;
    }
    setMemos((list) => list.filter((m) => m.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <p className="text-[13px] text-muted">Les leçons de synthèse de vos séances, à relire avant chaque tâche.</p>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <IconSearch size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher dans l'aide-mémoire" className="input w-full pl-9 sm:w-[200px]" type="search" />
          </label>
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={openNew}>
              <IconPlus size={16} /> Leçon
            </button>
          )}
        </div>
      </div>

      {draft && (
        <form onSubmit={save} className="card flex flex-col gap-3 p-4 sm:p-5 print:hidden">
          <p className="text-[15px] font-bold">{editing ? "Modifier la leçon" : "Nouvelle leçon"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            <Segmented
              label="Examen de la leçon"
              value={draft.exam}
              onChange={(v) => setDraft((d) => d && { ...d, exam: v })}
              options={[
                { value: "tcf", label: "TCF" },
                { value: "ielts", label: "IELTS" },
              ]}
            />
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => d && { ...d, title: e.target.value })}
              className="input"
              placeholder={guessTitle(draft.body) || "Titre (repris du texte si vide)"}
              aria-label="Titre de la leçon"
              maxLength={200}
            />
          </div>
          <Segmented
            label="Mode d'édition"
            value={preview ? "apercu" : "texte"}
            onChange={(v) => setPreview(v === "apercu")}
            options={[
              { value: "texte", label: "Texte" },
              { value: "apercu", label: "Aperçu" },
            ]}
          />
          {preview ? (
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-line p-4">
              {draft.body.trim() ? <Markdown blocks={previewBlocks} /> : <p className="text-muted">Rien à afficher.</p>}
            </div>
          ) : (
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => d && { ...d, body: e.target.value })}
              rows={14}
              className="input mono text-[12.5px]"
              placeholder="Collez ici la leçon telle que votre correcteur l'a écrite (titres #, tableaux |, listes…)."
              aria-label="Texte de la leçon"
              autoFocus
            />
          )}
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
                setDraft(null);
                setEditing(null);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {error && !draft && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <EmptyState icon={<IconBook size={20} />} title={memos.length ? "Aucune leçon ne correspond" : "Aucune leçon pour l'instant"}>
          {memos.length ? "Essayez un autre mot." : "Ajoutez une leçon en collant le texte de votre correcteur : titres, tableaux et listes sont mis en forme."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((m) => (
            <MemoCard
              key={m.id}
              memo={m}
              open={openId === m.id}
              onToggle={() => setOpenId((o) => (o === m.id ? null : m.id))}
              canEdit={canEdit}
              onEdit={() => {
                setEditing(m.id);
                setDraft({ exam: m.exam, title: m.title, body: m.body });
                setPreview(false);
                setError(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onDelete={() => remove(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
