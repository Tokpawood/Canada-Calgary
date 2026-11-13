"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";
import { DocumentDrawer } from "./DocumentDrawer";

type FilterKey = "all" | DocumentStatus;

const FILTERS: Array<[FilterKey, string]> = [
  ["all", "Tous"],
  ["À obtenir", "À obtenir"],
  ["Demandé", "Demandé"],
  ["Obtenu", "Obtenu"],
];

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

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  function updateDoc(updated: DocumentRecord) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function addDocument() {
    const name = newName.trim();
    if (!name) return;
    const id = `d-${Date.now().toString(36)}`;
    const position = documents.length;
    const { error } = await supabase.from("document").insert({ id, dossier_id: dossierId, name, position });
    if (!error) {
      setDocuments((prev) => [
        ...prev,
        { id, dossierId, name, status: "À obtenir", use: "", from: "", date: "", notes: "", req: "Obligatoire", format: "", validity: "", checks: [], links: [], files: [] },
      ]);
      setNewName("");
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface p-1">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${filter === key ? "bg-act-soft text-act" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
          <button type="button" onClick={() => setAdding((v) => !v)} className="rounded-lg bg-act px-3 py-1.5 text-sm font-semibold text-act-ink">
            + Document
          </button>
        </div>
      </div>

      {adding && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3">
          <label className="flex-1 text-sm">
            Nom du document
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm" />
          </label>
          <button type="button" onClick={addDocument} className="rounded-md bg-act px-3 py-1.5 text-sm font-semibold text-act-ink">
            Ajouter
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        {filtered.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedId(d.id)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line px-4 py-2.5 text-left first:border-t-0 hover:bg-surface-2"
          >
            <span className="truncate text-sm font-semibold">{d.name}</span>
            {d.status === "Obtenu" && d.checks.some((c) => !c.done) && (
              <span className="rounded-md bg-opt-bg px-1.5 py-0.5 text-[11px] font-semibold text-opt">Contrôles incomplets</span>
            )}
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${statusColor(d.status)}`}>{d.status}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="px-4 py-6 text-sm text-muted">Aucun document.</p>}
      </div>

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

function statusColor(status: DocumentStatus): string {
  if (status === "Obtenu") return "bg-ok-bg text-ok";
  if (status === "Demandé") return "bg-run-bg text-run";
  return "bg-todo-bg text-todo";
}
