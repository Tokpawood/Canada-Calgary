"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { joinUploadErrors } from "@/lib/documents";
import { StatusMessage } from "@/components/coffre/StatusMessage";
import { createPortal } from "react-dom";
import { FilePreview } from "@/components/coffre/FilePreview";
import { createClient } from "@/lib/supabase/client";
import { deleteVaultFile, signFileUrl, uploadMany } from "@/lib/vaultClient";
import type { DocumentRecord, DocumentRequirement, DocumentStatus } from "@/lib/types";
import { ConfirmButton, DOC_TONE, Drawer, Field, Meter, TONE_DOT, fmtShortDate } from "@/components/ui";
import { HeaderTabs } from "@/components/DarkHeader";
import { DarkStatusPicker, DrawerCard, DrawerFacts, DrawerTitle, ReadRow } from "@/components/DrawerParts";
import { Checklist, LinkList } from "@/components/EditableLists";
import { FileDropzone, VaultFileRow } from "@/components/FileDropzone";
import { IconAlert, IconTrash } from "@/components/icons";
import { EditBar, changedFields, isTmp, tmpId, useEditable } from "@/components/editable";

type DocDraft = Pick<DocumentRecord, "name" | "status" | "req" | "date" | "format" | "validity" | "use" | "from" | "notes" | "checks" | "links">;

const STATUSES: DocumentStatus[] = ["À obtenir", "Demandé", "Obtenu"];
const REQS: DocumentRequirement[] = ["Obligatoire", "Conseillé", "Si applicable"];

interface Props {
  doc: DocumentRecord;
  onChange: (doc: DocumentRecord) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DocumentDrawer({ doc, onChange, onDelete, onClose }: Props) {
  const supabase = createClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadCount, setUploadCount] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  // Dernière version de la fiche : les envois longs ne doivent pas écraser un contrôle coché entre-temps.
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const patchDoc = (patch: (d: DocumentRecord) => DocumentRecord) => {
    const next = patch(docRef.current);
    docRef.current = next;
    onChange(next);
  };

  const [warn, setWarn] = useState(false);
  const [tab, setTab] = useState<"controles" | "scans" | "infos" | "liens">("controles");

  const saved: DocDraft = useMemo(
    () => ({ name: doc.name, status: doc.status, req: doc.req, date: doc.date, format: doc.format, validity: doc.validity, use: doc.use, from: doc.from, notes: doc.notes, checks: doc.checks, links: doc.links }),
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

    const changed = changedFields(saved, d, ["name", "status", "req", "date", "format", "validity", "use", "from", "notes"]);
    const dbPatch: Record<string, unknown> = {};
    if ("name" in changed) dbPatch.name = changed.name;
    if ("status" in changed) dbPatch.status = changed.status;
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
    if (previewId) return; // Échap ferme d'abord l'aperçu
    if (ed.dirty) {
      setWarn(true);
      return;
    }
    onClose();
  }

  async function toggleCheck(checkId: string, done: boolean) {
    setActionError(null);
    patchDoc((d) => ({ ...d, checks: d.checks.map((c) => (c.id === checkId ? { ...c, done } : c)) }));
    const { error } = await supabase.from("document_check").update({ done }).eq("id", checkId);
    if (error) {
      patchDoc((d) => ({ ...d, checks: d.checks.map((c) => (c.id === checkId ? { ...c, done: !done } : c)) }));
      setActionError(`Le contrôle n'a pas pu être enregistré : ${error.message}`);
    }
  }

  async function handleUpload(fileList: FileList) {
    setUploading(true);
    setUploadNotice(null);
    setUploadError(null);
    const errors: string[] = [];
    const swapped: string[] = [];
    const list = Array.from(fileList);
    const progress = new Map<File, number>();
    setUploadPct(0);
    let finished = 0;
    setUploadCount(`0 fichier sur ${list.length} terminé`);
    await uploadMany(
      list,
      { documentId: doc.id },
      (file, res) => {
        finished += 1;
        setUploadCount(`${finished} fichier${finished > 1 ? "s" : ""} sur ${list.length} terminé${finished > 1 ? "s" : ""}`);
        if (res.error || !res.file) {
          errors.push(`${file.name} : ${res.error ?? "fichier refusé."}`);
          setUploadError(joinUploadErrors(errors));
          return;
        }
        const saved = res.file;
        const oldId = res.replaced?.id;
        patchDoc((d) => ({ ...d, files: [...d.files.filter((f) => f.id !== oldId && f.id !== saved.id), saved] }));
        if (res.replaced) {
          swapped.push(saved.name);
          setUploadNotice(`${swapped.join(", ")} : nouvelle version enregistrée, l'ancienne est conservée dans Coffre › Remplacés.`);
        }
      },
      (file, p) => {
        progress.set(file, p);
        setUploadPct([...progress.values()].reduce((s, v) => s + v, 0) / list.length);
      },
    );
    setUploadPct(null);
    setUploadCount(undefined);
    setUploading(false);
  }

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewIndex = previewId ? doc.files.findIndex((f) => f.id === previewId) : -1;
  const signUrl = signFileUrl;

  async function deleteFile(fileId: string) {
    const removed = docRef.current.files.find((f) => f.id === fileId);
    setUploadError(null);
    patchDoc((d) => ({ ...d, files: d.files.filter((f) => f.id !== fileId) }));
    const err = await deleteVaultFile(fileId);
    if (err) {
      setUploadError(`${removed?.name ?? "Fichier"} : ${err}`);
      if (removed) patchDoc((d) => ({ ...d, files: [...d.files, removed] }));
    }
  }

  async function handleDeleteDoc() {
    setActionError(null);
    // Fiche et scans sont supprimés ensemble côté serveur, en une seule transaction.
    const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res) {
      setActionError("Serveur injoignable : rien n'a été supprimé.");
      return;
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setActionError(`Suppression refusée : ${json.error ?? "erreur inconnue"}. Rien n'a été supprimé.`);
      return;
    }
    onDelete();
  }

  const reqTone = doc.req === "Obligatoire" ? "bg-bad text-white" : doc.req === "Conseillé" ? "bg-white/15" : "bg-white/10 text-night-muted";

  return (
    <Drawer
      label={`Document : ${doc.name}`}
      onClose={guardedClose}
      header={
        <>
          <div className="flex flex-wrap items-center gap-2 pr-12">
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${reqTone}`}>{doc.req}</span>
            {doc.use && <span className="truncate text-[12px] text-night-muted">Sert pour : {doc.use}</span>}
          </div>
          <DrawerTitle value={v.name} editing={ed.editing} onChange={(name) => ed.set({ name })} label="Nom du document" />
          <div className="mt-2.5">
            <DarkStatusPicker options={STATUSES} value={v.status} editing={ed.editing} onChange={(status) => ed.set({ status })} dotClass={(s) => TONE_DOT[DOC_TONE[s]]} label="Statut du document" />
          </div>
          <DrawerFacts
            items={[
              { label: "Contrôles", value: v.checks.length ? `${checksDone}/${v.checks.length}` : "—", tone: v.checks.length ? (incompleteChecks ? (doc.status === "Obtenu" ? "bad" : undefined) : "ok") : undefined },
              { label: "Scans", value: String(doc.files.length), tone: doc.files.length ? "ok" : undefined },
              { label: "Obtenu le", value: doc.date ? fmtShortDate(doc.date) : "—" },
            ]}
          />
        </>
      }
      tabs={
        <HeaderTabs
          label="Sections du document"
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "controles", label: "Contrôles", badge: v.checks.length ? { text: `${checksDone}/${v.checks.length}`, tone: doc.status === "Obtenu" && incompleteChecks ? "signal" : "plain" } : null },
            { id: "scans", label: "Scans", badge: doc.files.length ? { text: String(doc.files.length) } : null },
            { id: "infos", label: "Infos" },
            { id: "liens", label: "Liens", badge: v.links.length ? { text: String(v.links.length) } : null },
          ]}
        />
      }
      footer={
        <div>
          {warn && <p className="mb-2 text-[12.5px] font-semibold text-bad">Modifications non enregistrées : enregistrez-les ou annulez avant de fermer.</p>}
          <div className="flex items-center justify-between gap-2">
            {ed.editing ? (
              <span className="text-[12.5px] font-semibold text-opt">Modification en cours</span>
            ) : (
              <ConfirmButton label="Supprimer le document" confirmLabel="Confirmer (scans compris)" onConfirm={handleDeleteDoc}>
                <IconTrash size={14} />
                <span className="hidden sm:inline">Supprimer</span>
              </ConfirmButton>
            )}
            <EditBar edit={ed} />
          </div>
        </div>
      }
    >
      {actionError && (
        <StatusMessage tone="bad" onDismiss={() => setActionError(null)} className="mb-4">
          {actionError}
        </StatusMessage>
      )}
      {v.status === "Obtenu" && incompleteChecks && tab !== "controles" && (
        <button
          type="button"
          onClick={() => setTab("controles")}
          className="mb-4 flex w-full gap-2.5 rounded-xl border border-opt/25 bg-opt-bg p-3 text-left text-[13px] text-opt hover:border-opt/50"
        >
          <IconAlert size={16} className="mt-px shrink-0" />
          <span>Document obtenu mais {v.checks.length - checksDone} contrôle(s) restent à faire avant le dépôt.</span>
        </button>
      )}

      {tab === "controles" && (
        <DrawerCard
          title="Contrôles avant dépôt"
          sub={ed.editing ? "Ajoutez ou retirez des contrôles." : "Cochez chaque point vérifié sur la pièce."}
          aside={v.checks.length > 0 ? <span className="mono text-[12px] text-muted">{Math.round((checksDone / v.checks.length) * 100)} %</span> : undefined}
        >
          {v.status === "Obtenu" && incompleteChecks && (
            <p className="mb-3 flex gap-2 rounded-lg bg-opt-bg px-3 py-2 text-[12.5px] text-opt">
              <IconAlert size={15} className="mt-px shrink-0" />
              {v.checks.length - checksDone} contrôle(s) restent à faire avant le dépôt.
            </p>
          )}
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
        </DrawerCard>
      )}

      {tab === "infos" && (
        <DrawerCard title="Caractéristiques">
          {off ? (
            <dl className="m-0">
              <ReadRow label="Caractère" value={doc.req} />
              <ReadRow label="Date d'obtention" value={doc.date ? fmtShortDate(doc.date) : ""} />
              <ReadRow label="Format attendu" value={doc.format} />
              <ReadRow label="Validité" value={doc.validity} />
              <ReadRow label="Sert pour" value={doc.use} />
              <ReadRow label="Délivré par" value={doc.from} />
              <ReadRow label="Notes" value={doc.notes} />
            </dl>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Caractère">
                <select value={v.req} onChange={(e) => ed.set({ req: e.target.value as DocumentRequirement })} className="input">
                  {REQS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date d'obtention">
                <input type="date" value={v.date} onChange={(e) => ed.set({ date: e.target.value })} className="input" />
              </Field>
              <Field label="Format attendu">
                <input value={v.format} onChange={(e) => ed.set({ format: e.target.value })} className="input" />
              </Field>
              <Field label="Validité">
                <input value={v.validity} onChange={(e) => ed.set({ validity: e.target.value })} className="input" />
              </Field>
              <Field label="Sert pour" className="col-span-2">
                <input value={v.use} onChange={(e) => ed.set({ use: e.target.value })} className="input" />
              </Field>
              <Field label="Délivré par" className="col-span-2">
                <input value={v.from} onChange={(e) => ed.set({ from: e.target.value })} className="input" />
              </Field>
              <Field label="Notes" className="col-span-2">
                <textarea value={v.notes} onChange={(e) => ed.set({ notes: e.target.value })} className="input" />
              </Field>
            </div>
          )}
        </DrawerCard>
      )}

      {tab === "liens" && (
        <DrawerCard title="Liens officiels" sub="Uniquement des adresses en https://.">
          <LinkList
            links={v.links}
            editable={ed.editing}
            onAdd={(label, url) => ed.update((d) => ({ ...d, links: [...d.links, { id: tmpId(), label, url }] }))}
            onDelete={(id) => ed.update((d) => ({ ...d, links: d.links.filter((l) => l.id !== id) }))}
          />
        </DrawerCard>
      )}

      {tab === "scans" && (
      <DrawerCard title="Scans dans le coffre" sub="Enregistrés dans votre Google Drive, lus via l'application." aside={<span className="mono text-[12px] text-muted">{doc.files.length}</span>}>
        {doc.files.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1.5">
            {doc.files.map((f) => (
              <VaultFileRow key={f.id} file={f} onOpen={() => setPreviewId(f.id)} onDelete={() => deleteFile(f.id)} />
            ))}
          </ul>
        )}
        <FileDropzone compact busy={uploading} progress={uploadPct} progressLabel={uploadCount} onFiles={handleUpload} title="Ajouter des scans" />
        {uploadError && (
          <StatusMessage tone="bad" onDismiss={() => setUploadError(null)} className="mt-2">
            {uploadError}
          </StatusMessage>
        )}
        {uploadNotice && (
          <StatusMessage tone="ok" onDismiss={() => setUploadNotice(null)} className="mt-2">
            {uploadNotice}
          </StatusMessage>
        )}
        {doc.files.length === 0 && doc.status === "Obtenu" && !uploading && (
          <p className="mt-2 text-[12px] text-muted">Pièce obtenue : déposez son scan pour l&apos;avoir sous la main au moment du dépôt.</p>
        )}
      </DrawerCard>
      )}
        {previewIndex >= 0 &&
          createPortal(
            <FilePreview
              files={doc.files}
              index={previewIndex}
              documentLabel={() => doc.name}
              signUrl={signUrl}
              onIndex={(i) => setPreviewId(doc.files[i]?.id ?? null)}
              onDelete={(f) => {
                const next = doc.files[previewIndex + 1] ?? doc.files[previewIndex - 1];
                setPreviewId(next && next.id !== f.id ? next.id : null);
                void deleteFile(f.id);
              }}
              onClose={() => setPreviewId(null)}
            />,
            document.body,
          )}
    </Drawer>
  );
}
