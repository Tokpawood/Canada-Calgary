"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapVaultFile } from "@/lib/queries";
import { validateVaultFile } from "@/lib/fileSniff";
import type { DocumentRecord, DocumentRequirement, DocumentStatus } from "@/lib/types";
import { timestamp } from "@/lib/ids";
import { Chip, ConfirmButton, DOC_TONE, Drawer, DrawerSection, Field, Meter, TONE_DOT } from "@/components/ui";
import { Checklist, LinkList } from "@/components/EditableLists";
import { FileDropzone, VaultFileRow } from "@/components/FileDropzone";
import { IconAlert, IconTrash } from "@/components/icons";

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const checksDone = doc.checks.filter((c) => c.done).length;
  const incompleteChecks = checksDone < doc.checks.length;

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

  async function addCheck(text: string) {
    const { data } = await supabase.from("document_check").insert({ document_id: doc.id, text, done: false, position: doc.checks.length }).select("id").single();
    if (data) onChange({ ...doc, checks: [...doc.checks, { id: data.id as string, text, done: false, position: doc.checks.length }] });
  }

  async function deleteCheck(checkId: string) {
    onChange({ ...doc, checks: doc.checks.filter((c) => c.id !== checkId) });
    await supabase.from("document_check").delete().eq("id", checkId);
  }

  async function addLink(label: string, url: string) {
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
    let files = doc.files;
    for (const file of Array.from(fileList)) {
      const validation = await validateVaultFile(file);
      if (!validation.ok) {
        setUploadError(`${file.name} : ${validation.reason ?? "fichier refusé."}`);
        continue;
      }
      const path = `${doc.dossierId}/${doc.id}/${timestamp()}-${sanitizeName(file.name)}`;
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
      if (data) {
        files = [...files, mapVaultFile(data)];
        onChange({ ...doc, files });
      }
    }
    setUploading(false);
  }

  async function openFile(storagePath: string) {
    const { data } = await supabase.storage.from("coffre").createSignedUrl(storagePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteFile(fileId: string, storagePath: string) {
    onChange({ ...doc, files: doc.files.filter((f) => f.id !== fileId) });
    await Promise.all([supabase.storage.from("coffre").remove([storagePath]), supabase.from("file").delete().eq("id", fileId)]);
  }

  async function handleDeleteDoc() {
    for (const f of doc.files) await supabase.storage.from("coffre").remove([f.storagePath]);
    await supabase.from("document").delete().eq("id", doc.id);
    onDelete();
  }

  return (
    <Drawer
      label={`Document : ${doc.name}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <ConfirmButton label="Supprimer le document" confirmLabel="Confirmer (scans compris)" onConfirm={handleDeleteDoc}>
            <IconTrash size={14} />
            Supprimer le document
          </ConfirmButton>
        </div>
      }
    >
      <div className="flex items-center gap-2 pr-10">
        <Chip tone={doc.req === "Obligatoire" ? "bad" : doc.req === "Conseillé" ? "run" : "todo"}>{doc.req}</Chip>
        {doc.use && <span className="truncate text-[12.5px] text-muted">Sert pour : {doc.use}</span>}
      </div>
      <textarea
        value={doc.name}
        rows={1}
        onChange={(e) => patchDoc({ name: e.target.value })}
        aria-label="Nom du document"
        className="input-ghost -mx-1.5 mt-2 resize-none font-display text-[21px] leading-snug font-bold"
      />

      <div role="radiogroup" aria-label="Statut du document" className="mt-3 grid grid-cols-3 gap-1.5">
        {STATUSES.map((s) => {
          const active = doc.status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => patchDoc({ status: s })}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                active ? "border-act bg-act-soft text-act" : "border-line text-muted hover:text-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[DOC_TONE[s]]}`} />
              {s}
            </button>
          );
        })}
      </div>

      {doc.status === "Obtenu" && incompleteChecks && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-opt/25 bg-opt-bg p-3 text-[13.5px] text-opt">
          <IconAlert size={17} className="mt-px shrink-0" />
          <p>Document obtenu mais {doc.checks.length - checksDone} contrôle(s) restent à faire avant le dépôt.</p>
        </div>
      )}

      <DrawerSection title="Contrôles avant dépôt" aside={doc.checks.length > 0 ? <span className="mono text-[12px] text-muted">{checksDone}/{doc.checks.length}</span> : undefined}>
        {doc.checks.length > 0 && <Meter value={(checksDone / doc.checks.length) * 100} tone="ok" height={4} className="mb-2" label="Contrôles faits" />}
        <Checklist items={doc.checks} onToggle={toggleCheck} onDelete={deleteCheck} onAdd={addCheck} placeholder="Ajouter un contrôle" />
      </DrawerSection>

      <DrawerSection title="Scans dans le coffre" aside={<span className="mono text-[12px] text-muted">{doc.files.length}</span>}>
        {doc.files.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1.5">
            {doc.files.map((f) => (
              <VaultFileRow key={f.id} file={f} onOpen={() => openFile(f.storagePath)} onDelete={() => deleteFile(f.id, f.storagePath)} />
            ))}
          </ul>
        )}
        <FileDropzone compact busy={uploading} onFiles={handleUpload} title="Ajouter un scan" />
        {uploadError && <p className="mt-1.5 text-[12px] text-bad">{uploadError}</p>}
      </DrawerSection>

      <DrawerSection title="Liens officiels">
        <LinkList links={doc.links} onAdd={addLink} onDelete={deleteLink} />
      </DrawerSection>

      <DrawerSection title="Caractéristiques">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Caractère">
            <select value={doc.req} onChange={(e) => patchDoc({ req: e.target.value as DocumentRequirement })} className="input">
              {REQS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date d'obtention">
            <input type="date" value={doc.date} onChange={(e) => patchDoc({ date: e.target.value })} className="input" />
          </Field>
          <Field label="Format attendu">
            <input value={doc.format} onChange={(e) => patchDoc({ format: e.target.value })} className="input" />
          </Field>
          <Field label="Validité">
            <input value={doc.validity} onChange={(e) => patchDoc({ validity: e.target.value })} className="input" />
          </Field>
          <Field label="Sert pour" className="col-span-2">
            <input value={doc.use} onChange={(e) => patchDoc({ use: e.target.value })} className="input" />
          </Field>
          <Field label="Délivré par" className="col-span-2">
            <input value={doc.from} onChange={(e) => patchDoc({ from: e.target.value })} className="input" />
          </Field>
          <Field label="Notes" className="col-span-2">
            <textarea value={doc.notes} onChange={(e) => patchDoc({ notes: e.target.value })} className="input" />
          </Field>
        </div>
      </DrawerSection>
    </Drawer>
  );
}
