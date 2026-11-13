"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeUrl } from "@/lib/rules";
import { mapVaultFile } from "@/lib/queries";
import { validateVaultFile } from "@/lib/fileSniff";
import type { DocumentRecord, DocumentRequirement, DocumentStatus } from "@/lib/types";

const STATUSES: DocumentStatus[] = ["À obtenir", "Demandé", "Obtenu"];
const REQS: DocumentRequirement[] = ["Obligatoire", "Conseillé", "Si applicable"];

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

interface Props {
  doc: DocumentRecord;
  onChange: (doc: DocumentRecord) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DocumentDrawer({ doc, onChange, onDelete, onClose }: Props) {
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmFileId, setConfirmFileId] = useState<string | null>(null);
  const [newCheck, setNewCheck] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const incompleteChecks = doc.checks.some((c) => !c.done);

  async function patchDoc(patch: Partial<DocumentRecord>) {
    const dbPatch: Record<string, unknown> = {};
    if ("name" in patch) dbPatch.name = patch.name;
    if ("status" in patch) dbPatch.status = patch.status;
    if ("use" in patch) dbPatch.use_ = patch.use;
    if ("from" in patch) dbPatch.from_org = patch.from;
    if ("date" in patch) dbPatch.date = patch.date || null;
    if ("notes" in patch) dbPatch.notes = patch.notes;
    if ("req" in patch) dbPatch.req = patch.req;
    if ("format" in patch) dbPatch.format = patch.format;
    if ("validity" in patch) dbPatch.validity = patch.validity;

    onChange({ ...doc, ...patch });
    await supabase.from("document").update(dbPatch).eq("id", doc.id);
  }

  async function toggleCheck(checkId: string, done: boolean) {
    onChange({ ...doc, checks: doc.checks.map((c) => (c.id === checkId ? { ...c, done } : c)) });
    await supabase.from("document_check").update({ done }).eq("id", checkId);
  }

  async function addCheck() {
    const text = newCheck.trim();
    if (!text) return;
    setNewCheck("");
    const { data } = await supabase
      .from("document_check")
      .insert({ document_id: doc.id, text, done: false, position: doc.checks.length })
      .select("id")
      .single();
    if (data) onChange({ ...doc, checks: [...doc.checks, { id: data.id as string, text, done: false, position: doc.checks.length }] });
  }

  async function deleteCheck(checkId: string) {
    onChange({ ...doc, checks: doc.checks.filter((c) => c.id !== checkId) });
    await supabase.from("document_check").delete().eq("id", checkId);
  }

  async function addLink() {
    const url = safeUrl(newLinkUrl);
    if (!url) {
      setLinkError("Adresse invalide : elle doit commencer par https://");
      return;
    }
    const label = newLinkLabel.trim() || url;
    setLinkError(null);
    setNewLinkLabel("");
    setNewLinkUrl("");
    const { data } = await supabase.from("document_link").insert({ document_id: doc.id, label, url }).select("id").single();
    if (data) onChange({ ...doc, links: [...doc.links, { id: data.id as string, label, url }] });
  }

  async function deleteLink(linkId: string) {
    onChange({ ...doc, links: doc.links.filter((l) => l.id !== linkId) });
    await supabase.from("document_link").delete().eq("id", linkId);
  }

  async function handleUpload(fileList: FileList) {
    setUploading(true);
    setUploadError(null);
    for (const file of Array.from(fileList)) {
      const validation = await validateVaultFile(file);
      if (!validation.ok) {
        setUploadError(validation.reason ?? "Fichier refusé.");
        continue;
      }
      const path = `${doc.dossierId}/${doc.id}/${Date.now()}-${sanitizeName(file.name)}`;
      const { error: uploadErr } = await supabase.storage.from("coffre").upload(path, file, { contentType: validation.mime });
      if (uploadErr) {
        setUploadError(uploadErr.message);
        continue;
      }
      const { data } = await supabase
        .from("file")
        .insert({ dossier_id: doc.dossierId, document_id: doc.id, storage_path: path, name: file.name, size: file.size, mime: validation.mime })
        .select("*")
        .single();
      if (data) onChange({ ...doc, files: [...doc.files, mapVaultFile(data)] });
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function openFile(storagePath: string) {
    const { data } = await supabase.storage.from("coffre").createSignedUrl(storagePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteFile(fileId: string, storagePath: string) {
    if (confirmFileId !== fileId) {
      setConfirmFileId(fileId);
      return;
    }
    onChange({ ...doc, files: doc.files.filter((f) => f.id !== fileId) });
    await Promise.all([supabase.storage.from("coffre").remove([storagePath]), supabase.from("file").delete().eq("id", fileId)]);
    setConfirmFileId(null);
  }

  async function handleDeleteDoc() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    for (const f of doc.files) await supabase.storage.from("coffre").remove([f.storagePath]);
    await supabase.from("document").delete().eq("id", doc.id);
    onDelete();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${doc.req === "Obligatoire" ? "bg-bad-bg text-bad" : "bg-surface-2 text-muted"}`}>
            {doc.req}
          </span>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Fermer">
            ✕
          </button>
        </div>

        <input
          value={doc.name}
          onChange={(e) => patchDoc({ name: e.target.value })}
          className="mt-2 w-full rounded-md border border-transparent bg-transparent font-display text-xl font-bold focus:border-line focus:bg-surface-2 focus:outline-none"
        />

        {doc.status === "Obtenu" && incompleteChecks && (
          <p className="mt-2 rounded-lg bg-opt-bg p-2 text-sm text-opt">Contrôles incomplets</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patchDoc({ status: s })}
              aria-pressed={doc.status === s}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${doc.status === s ? "border-act bg-act-soft text-act" : "border-line text-muted"}`}
            >
              {s}
            </button>
          ))}
        </div>

        <Section title="Contrôles avant dépôt">
          <ul className="flex flex-col gap-1.5">
            {doc.checks.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input type="checkbox" checked={c.done} onChange={(e) => toggleCheck(c.id, e.target.checked)} />
                <span className={`flex-1 text-sm ${c.done ? "text-faint line-through" : ""}`}>{c.text}</span>
                <button type="button" onClick={() => deleteCheck(c.id)} className="text-xs text-faint hover:text-bad">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCheck()} placeholder="Ajouter un contrôle" className="flex-1 rounded-md border border-line px-2 py-1 text-sm" />
            <button type="button" onClick={addCheck} className="rounded-md bg-act-soft px-3 py-1 text-sm font-semibold text-act">
              Ajouter
            </button>
          </div>
        </Section>

        <Section title="Fichiers déposés (coffre)">
          <ul className="flex flex-col gap-1.5">
            {doc.files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm">
                <button type="button" onClick={() => openFile(f.storagePath)} className="flex-1 truncate text-left text-act underline">
                  {f.name}
                </button>
                <span className="font-mono text-xs text-muted">{Math.round(f.size / 1024)} Ko</span>
                <button
                  type="button"
                  onClick={() => deleteFile(f.id, f.storagePath)}
                  className={`text-xs font-semibold ${confirmFileId === f.id ? "text-bad" : "text-faint hover:text-bad"}`}
                >
                  {confirmFileId === f.id ? "Confirmer" : "Supprimer"}
                </button>
              </li>
            ))}
            {doc.files.length === 0 && <li className="text-sm text-muted">Aucun scan déposé.</li>}
          </ul>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading}
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
            className="mt-2 block w-full text-sm"
          />
          {uploadError && <p className="mt-1 text-xs text-bad">{uploadError}</p>}
        </Section>

        <Section title="Liens officiels">
          <ul className="flex flex-col gap-1.5">
            {doc.links.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-act underline">
                  {l.label}
                </a>
                <button type="button" onClick={() => deleteLink(l.id)} className="text-xs text-faint hover:text-bad">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-2">
            <input value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Libellé du lien" className="rounded-md border border-line px-2 py-1 text-sm" />
            <div className="flex gap-2">
              <input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="https://…" className="flex-1 rounded-md border border-line px-2 py-1 text-sm" />
              <button type="button" onClick={addLink} className="rounded-md bg-act-soft px-3 py-1 text-sm font-semibold text-act">
                Ajouter
              </button>
            </div>
            {linkError && <p className="text-xs text-bad">{linkError}</p>}
          </div>
        </Section>

        <Section title="Caractéristiques">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Caractère">
              <select value={doc.req} onChange={(e) => patchDoc({ req: e.target.value as DocumentRequirement })} className="w-full rounded-md border border-line px-2 py-1 text-sm">
                {REQS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date d'obtention">
              <input type="date" value={doc.date} onChange={(e) => patchDoc({ date: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
            </Field>
            <Field label="Format attendu">
              <input value={doc.format} onChange={(e) => patchDoc({ format: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
            </Field>
            <Field label="Validité">
              <input value={doc.validity} onChange={(e) => patchDoc({ validity: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
            </Field>
          </div>
          <Field label="Sert pour">
            <input value={doc.use} onChange={(e) => patchDoc({ use: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
          </Field>
          <Field label="Délivré par">
            <input value={doc.from} onChange={(e) => patchDoc({ from: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
          </Field>
          <Field label="Notes">
            <textarea value={doc.notes} onChange={(e) => patchDoc({ notes: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
          </Field>
        </Section>

        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <button type="button" onClick={handleDeleteDoc} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-bad-bg text-bad"}`}>
            {confirmDelete ? "Confirmer la suppression" : "Supprimer le document"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-medium text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
