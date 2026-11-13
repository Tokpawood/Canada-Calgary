"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapVaultFile } from "@/lib/queries";
import { validateVaultFile } from "@/lib/fileSniff";
import type { VaultFile } from "@/lib/types";
import { timestamp } from "@/lib/ids";
import { EmptyState, PageHeader } from "@/components/ui";
import { FileDropzone, VaultFileRow, formatSize } from "@/components/FileDropzone";
import { IconLock, IconShield } from "@/components/icons";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

interface Props {
  dossierId: string;
  initialFiles: VaultFile[];
  documentNames: Record<string, string>;
}

export function VaultBoard({ dossierId, initialFiles, documentNames }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const groups = useMemo(() => {
    const map = new Map<string, VaultFile[]>();
    for (const f of files) {
      const key = f.documentId ? (documentNames[f.documentId] ?? "Document") : "Non rattachés";
      const list = map.get(key);
      if (list) list.push(f);
      else map.set(key, [f]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a === "Non rattachés" ? 1 : b === "Non rattachés" ? -1 : a.localeCompare(b, "fr")));
  }, [files, documentNames]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  async function handleUpload(fileList: FileList) {
    setUploading(true);
    setError(null);
    for (const file of Array.from(fileList)) {
      const validation = await validateVaultFile(file);
      if (!validation.ok) {
        setError(`${file.name} : ${validation.reason ?? "fichier refusé."}`);
        continue;
      }
      const path = `${dossierId}/divers/${timestamp()}-${sanitizeName(file.name)}`;
      const { error: uploadErr } = await supabase.storage.from("coffre").upload(path, file, { contentType: validation.mime });
      if (uploadErr) {
        setError(uploadErr.message);
        continue;
      }
      const { data } = await supabase
        .from("file")
        .insert({ dossier_id: dossierId, document_id: null, storage_path: path, name: file.name, size: file.size, mime: validation.mime })
        .select("*")
        .single();
      if (data) setFiles((prev) => [...prev, mapVaultFile(data)]);
    }
    setUploading(false);
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage.from("coffre").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteFile(id: string, path: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    await Promise.all([supabase.storage.from("coffre").remove([path]), supabase.from("file").delete().eq("id", id)]);
  }

  return (
    <>
      <PageHeader
        title="Coffre"
        description={
          <>
            {files.length} fichier{files.length > 1 ? "s" : ""} · {formatSize(totalSize)}. Stockage privé : chaque ouverture passe par un lien sécurisé valable 5 minutes.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {groups.length === 0 ? (
            <EmptyState icon={<IconLock size={20} />} title="Le coffre est vide">
              Déposez un scan ci-contre, ou depuis la fiche d&apos;un document pour le lui rattacher.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(([group, groupFiles]) => (
                <section key={group} className="card p-4">
                  <div className="mb-2.5 flex items-baseline justify-between gap-2">
                    <h2 className="truncate text-[15px] font-bold">{group}</h2>
                    <span className="mono shrink-0 text-[12px] text-muted">{groupFiles.length}</span>
                  </div>
                  <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {groupFiles.map((f) => (
                      <VaultFileRow key={f.id} file={f} onOpen={() => openFile(f.storagePath)} onDelete={() => deleteFile(f.id, f.storagePath)} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <FileDropzone busy={uploading} onFiles={handleUpload} title="Déposer un fichier non rattaché" />
          {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{error}</p>}
          <div className="rounded-2xl border border-dashed border-line p-4 text-[12.5px] text-muted">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <IconShield size={15} className="text-act" /> Bon à savoir
            </p>
            <p className="mt-1.5">Pour rattacher un scan à une pièce précise (passeport, diplôme…), déposez-le depuis sa fiche dans l&apos;onglet Documents.</p>
            <p className="mt-1.5">Le type réel du fichier est vérifié avant l&apos;envoi : un fichier renommé en .pdf est refusé.</p>
          </div>
        </div>
      </div>
    </>
  );
}
