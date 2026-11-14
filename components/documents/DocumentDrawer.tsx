"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapVaultFile } from "@/lib/queries";
import { validateVaultFile } from "@/lib/fileSniff";
import type { DocumentRecord, DocumentRequirement, DocumentStatus } from "@/lib/types";
import { timestamp } from "@/lib/ids";
import { Chip, ConfirmButton, DOC_TONE, Drawer, DrawerSection, Field, Meter, TONE_DOT } from "@/components/ui";
import { Checklist, LinkList } from "@/components/EditableLists";
import { FileDropzone, VaultFileRow } from "@/components/FileDropzone";
import { IconAlert, IconTrash } from "@/components/icons";
import { EditBar, changedFields, isTmp, tmpId, useEditable } from "@/components/editable";

type DocDraft = Pick<DocumentRecord, "name" | "req" | "date" | "format" | "validity" | "use" | "from" | "notes" | "checks" | "links">;

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

  const [warn, setWarn] = useState(false);

  const saved: DocDraft = useMemo(
    () => ({ name: doc.name, req: doc.req, date: doc.date, format: doc.format, validity: doc.validity, use: doc.use, from: doc.from, notes: doc.notes, checks: doc.checks, links: doc.links }),
    [doc],
  );

  const ed = useEditable(saved, async (d) => {
    const removedChecks = doc.checks.filter((c) => !d.checks.some((x) => x.id === c.id)).map((c) => c.id);
    if (removedChecks.length) {
      const { error } = await supabase.from("document_check").delete().in("id", removedChecks);
      if (error) throw error;
    }
    const checks: DocumentRecord["checks"] = [];
    for (const [i, c] of d.checks.entries()) {
      if (!isTmp(c.id)) {
        checks.push(c);
        continue;
      }
      const { data, error } = await supabase.from("document_check").insert({ document_id: doc.id, text: c.text, done: false, position: i }).select("id").single();
      if (error) throw error;
      checks.push({ ...c, id: data.id as string, position: i });
    }

    const removedLinks = doc.links.filter((l) => !d.links.some((x) => x.id === l.id)).map((l) => l.id);
    if (removedLinks.length) {
      const { error } = await supabase.from("document_link").delete().in("id", removedLinks);
      if (error) throw error;
    }
    const links: DocumentRecord["links"] = [];
    for (const l of d.links) {
      if (!isTmp(l.id)) {
        links.push(l);
        continue;
      }
      const { data, error } = await supabase.from("document_link").insert({ document_id: doc.id, label: l.label, url: l.url }).select("id").single();
      if (error) throw error;
      links.push({ ...l, id: data.id as string });
    }

    const changed = changedFields(saved, d, ["name", "req", "date", "format", "validity", "use", "from", "notes"]);
    const dbPatch: Record<string, unknown> = {};
    if ("name" in changed) dbPatch.name = changed.name;
    if ("req" in changed) dbPatch.req = changed.req;
    if ("date" in changed) dbPatch.date = changed.date || null;
    if ("format" in changed) dbPatch.format = changed.format;
    if ("validity" in changed) dbPatch.validity = changed.validity;
    if ("use" in changed) dbPatch.use_ = changed.use;
    if ("from" in changed) dbPatch.from_org = changed.from;
    if ("notes" in changed) dbPatch.notes = changed.notes;
    if (Object.keys(dbPatch).length) {
      const { error } = await supabase.from("document").update(dbPatch).eq("id", doc.id);
      if (error) throw error;
    }
    onChange({ ...doc, ...d, checks, links });
    setWarn(false);
  });

  const v = ed.current;
  const off = !ed.editing;
  const checksDone = v.checks.filter((c) => c.done).length;
  const incompleteChecks = checksDone < v.checks.length;

  function guardedClose() {
    if (ed.dirty) {
      setWarn(true);
      return;
    }
    onClose();
  }

  async function setStatus(status: DocumentStatus) {
    onChange({ ...doc, status });
    await supabase.from("document").update({ status }).eq("id", doc.id);
  }

  async function toggleCheck(checkId: string, done: boolean) {
    onChange({ ...doc, checks: doc.checks.map((c) => (c.id === checkId ? { ...c, done } : c)) });
    await supabase.from("document_check").update({ done }).eq("id", checkId);
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
      onClose={guardedClose}
      footer={
        ed.editing ? (
          <div>
            {warn && <p className="mb-2 text-[12.5px] font-semibold text-bad">Modifications non enregistrées : enregistrez-les ou annulez avant de fermer.</p>}
            <EditBar edit={ed} />
          </div>
        ) : (
          <div className="flex justify-end gap-1.5">
            <EditBar edit={ed} />
            <ConfirmButton label="Supprimer le document" confirmLabel="Confirmer (scans compris)" onConfirm={handleDeleteDoc}>
              <IconTrash size={14} />
              <span className="hidden sm:inline">Supprimer</span>
            </ConfirmButton>
          </div>
        )
      }
    >
      <div className="flex items-center gap-2 pr-10">
        <Chip tone={doc.req === "Obligatoire" ? "bad" : doc.req === "Conseillé" ? "run" : "todo"}>{doc.req}</Chip>
        {doc.use && <span className="truncate text-[12.5px] text-muted">Sert pour : {doc.use}</span>}
        {ed.editing && <span className="rounded-md bg-act px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-act-ink uppercase">Modification</span>}
      </div>
      <textarea
        value={v.name}
        rows={1}
        disabled={off}
        onChange={(e) => ed.set({ name: e.target.value })}
        aria-label="Nom du document"
        className={`input-ghost -mx-1.5 mt-2 resize-none font-display text-[21px] leading-snug font-bold ${off ? "" : "border-line bg-surface"}`}
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
              disabled={ed.editing}
              onClick={() => setStatus(s)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-default disabled:opacity-60 ${
                active ? "border-act bg-act-soft text-act" : "border-line text-muted enabled:hover:text-ink"
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
          <p>Document obtenu mais {v.checks.length - checksDone} contrôle(s) restent à faire avant le dépôt.</p>
        </div>
      )}

      <DrawerSection title="Contrôles avant dépôt" aside={v.checks.length > 0 ? <span className="mono text-[12px] text-muted">{checksDone}/{v.checks.length}</span> : undefined}>
        {v.checks.length > 0 && <Meter value={(checksDone / v.checks.length) * 100} tone="ok" height={4} className="mb-2" label="Contrôles faits" />}
        <Checklist
          items={v.checks}
          editable={ed.editing}
          toggleDisabled={ed.editing}
          onToggle={toggleCheck}
          onDelete={(id) => ed.update((d) => ({ ...d, checks: d.checks.filter((c) => c.id !== id) }))}
          onAdd={(text) => ed.update((d) => ({ ...d, checks: [...d.checks, { id: tmpId(), text, done: false, position: d.checks.length }] }))}
          placeholder="Ajouter un contrôle"
        />
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
        <LinkList
          links={v.links}
          editable={ed.editing}
          onAdd={(label, url) => ed.update((d) => ({ ...d, links: [...d.links, { id: tmpId(), label, url }] }))}
          onDelete={(id) => ed.update((d) => ({ ...d, links: d.links.filter((l) => l.id !== id) }))}
        />
      </DrawerSection>

      <DrawerSection title="Caractéristiques">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Caractère">
            <select disabled={off} value={v.req} onChange={(e) => ed.set({ req: e.target.value as DocumentRequirement })} className="input">
              {REQS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date d'obtention">
            <input type="date" disabled={off} value={v.date} onChange={(e) => ed.set({ date: e.target.value })} className="input" />
          </Field>
          <Field label="Format attendu">
            <input disabled={off} value={v.format} onChange={(e) => ed.set({ format: e.target.value })} className="input" />
          </Field>
          <Field label="Validité">
            <input disabled={off} value={v.validity} onChange={(e) => ed.set({ validity: e.target.value })} className="input" />
          </Field>
          <Field label="Sert pour" className="col-span-2">
            <input disabled={off} value={v.use} onChange={(e) => ed.set({ use: e.target.value })} className="input" />
          </Field>
          <Field label="Délivré par" className="col-span-2">
            <input disabled={off} value={v.from} onChange={(e) => ed.set({ from: e.target.value })} className="input" />
          </Field>
          <Field label="Notes" className="col-span-2">
            <textarea disabled={off} value={v.notes} onChange={(e) => ed.set({ notes: e.target.value })} className="input" />
          </Field>
        </div>
      </DrawerSection>
    </Drawer>
  );
}
