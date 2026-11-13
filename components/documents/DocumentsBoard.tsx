"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";
import { newId } from "@/lib/ids";
import { Chip, DOC_TONE, EmptyState, Segmented, TONE_DOT } from "@/components/ui";
import { IconFile, IconPaperclip, IconPlus, IconSearch } from "@/components/icons";
import { DocumentDrawer } from "./DocumentDrawer";

type FilterKey = "all" | DocumentStatus;
const STATUSES: DocumentStatus[] = ["Obtenu", "Demandé", "À obtenir"];

export function DocumentsBoard({ initialDocuments, dossierId }: { initialDocuments: DocumentRecord[]; dossierId: string }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const supabase = createClient();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (filter !== "all" && d.status !== filter) return false;
      if (q && !`${d.name} ${d.use} ${d.from}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, filter, query]);

  const count = (s: DocumentStatus) => documents.filter((d) => d.status === s).length;
  const mandatoryMissing = documents.filter((d) => d.req === "Obligatoire" && d.status !== "Obtenu").length;
  const incompleteChecks = documents.filter((d) => d.status === "Obtenu" && d.checks.some((c) => !c.done)).length;
  const total = documents.length || 1;

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  function updateDoc(updated: DocumentRecord) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function addDocument() {
    const name = newName.trim();
    if (!name) return;
    const id = newId("d");
    const { error } = await supabase.from("document").insert({ id, dossier_id: dossierId, name, position: documents.length });
    if (!error) {
      setDocuments((prev) => [
        ...prev,
        { id, dossierId, name, status: "À obtenir", use: "", from: "", date: "", notes: "", req: "Obligatoire", format: "", validity: "", checks: [], links: [], files: [] },
      ]);
      setNewName("");
      setAdding(false);
      setSelectedId(id);
    }
  }

  return (
    <div className="min-w-0">
      <div className="card mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12.5px] font-medium text-muted">Documents obtenus</p>
            <p className="mt-1 font-display text-[30px] leading-none font-bold">
              {count("Obtenu")}
              <span className="ml-1 text-base font-semibold text-muted">/ {documents.length}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mandatoryMissing > 0 && <Chip tone="bad">{mandatoryMissing} obligatoire(s) manquant(s)</Chip>}
            {incompleteChecks > 0 && <Chip tone="opt">{incompleteChecks} à contrôler</Chip>}
          </div>
        </div>
        <div className="mt-4 flex h-2 gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Répartition des documents par statut">
          {STATUSES.map((s) => {
            const n = count(s);
            if (!n) return null;
            return <span key={s} title={`${s} : ${n}`} className={`h-full first:rounded-l-full last:rounded-r-full ${TONE_DOT[DOC_TONE[s]]} ${s === "À obtenir" ? "opacity-30" : ""}`} style={{ width: `${(n / total) * 100}%` }} />;
          })}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${TONE_DOT[DOC_TONE[s]]} ${s === "À obtenir" ? "opacity-30" : ""}`} />
              {s} <span className="mono text-ink">{count(s)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented<FilterKey>
          label="Filtrer les documents"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tous", count: documents.length },
            { value: "À obtenir", label: "À obtenir", count: count("À obtenir") },
            { value: "Demandé", label: "Demandés", count: count("Demandé") },
            { value: "Obtenu", label: "Obtenus", count: count("Obtenu") },
          ]}
        />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un document" className="input pl-9" />
          </div>
          <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="btn btn-primary">
            <IconPlus size={16} />
            <span className="hidden sm:inline">Document</span>
          </button>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addDocument();
          }}
          className="card anim-fade mb-3 flex flex-wrap items-end gap-2 p-4"
        >
          <label className="min-w-[220px] flex-1">
            <span className="field-label">Nom du document</span>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex. Relevé de notes du Bachelor" className="input" />
          </label>
          <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={!newName.trim()} className="btn btn-primary">
            Ajouter
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<IconFile size={20} />} title="Aucun document">
          {query ? "Aucun résultat pour cette recherche." : "Aucun document dans cette catégorie."}
        </EmptyState>
      ) : (
        <ul className="card overflow-hidden">
          {filtered.map((d) => {
            const checksDone = d.checks.filter((c) => c.done).length;
            const needsCheck = d.status === "Obtenu" && checksDone < d.checks.length;
            return (
              <li key={d.id} className="border-t border-line first:border-t-0">
                <button type="button" onClick={() => setSelectedId(d.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/70 sm:px-5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[DOC_TONE[d.status]]} ${d.status === "À obtenir" ? "opacity-40" : ""}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{d.name}</span>
                      {d.req === "Obligatoire" && d.status !== "Obtenu" && <span className="hidden text-[11px] font-semibold text-bad sm:inline">Obligatoire</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12px] text-muted">
                      {d.from && <span className="truncate">{d.from}</span>}
                      {d.checks.length > 0 && (
                        <span className={`mono ${needsCheck ? "font-semibold text-opt" : ""}`}>
                          {checksDone}/{d.checks.length} contrôles
                        </span>
                      )}
                      {d.files.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <IconPaperclip size={12} />
                          {d.files.length} scan{d.files.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  </span>
                  <Chip tone={DOC_TONE[d.status]}>{d.status}</Chip>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <DocumentDrawer
          doc={selected}
          onChange={updateDoc}
          onDelete={() => {
            setDocuments((prev) => prev.filter((d) => d.id !== selected.id));
            setSelectedId(null);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
