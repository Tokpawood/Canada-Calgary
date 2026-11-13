"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapVaultFile } from "@/lib/queries";
import { validateVaultFile } from "@/lib/fileSniff";
import type { VaultFile } from "@/lib/types";

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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const groups = useMemo(() => {
    const map = new Map<string, VaultFile[]>();
    for (const f of files) {
      const key = f.documentId ? documentNames[f.documentId] ?? "Document" : "Divers";
      const list = map.get(key);
      if (list) list.push(f);
      else map.set(key, [f]);
    }
    return Array.from(map.entries());
  }, [files, documentNames]);

  async function handleUpload(fileList: FileList) {
    setUploading(true);
    setError(null);
    for (const file of Array.from(fileList)) {
      const validation = await validateVaultFile(file);
      if (!validation.ok) {
        setError(validation.reason ?? "Fichier refusé.");
        continue;
      }
      const path = `${dossierId}/divers/${Date.now()}-${sanitizeName(file.name)}`;
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
    if (fileInput.current) fileInput.current.value = "";
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage.from("coffre").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteFile(id: string, path: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
    await Promise.all([supabase.storage.from("coffre").remove([path]), supabase.from("file").delete().eq("id", id)]);
    setConfirmId(null);
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <h3 className="text-sm font-bold">Déposer un fichier non rattaché</h3>
        <p className="mt-1 text-sm text-muted">PDF, JPEG, PNG ou WEBP, 20 Mo maximum. Pour rattacher un scan à un document précis, déposez-le depuis sa fiche dans l&apos;onglet Documents.</p>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading}
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="mt-3 block w-full text-sm"
        />
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      </div>

      {groups.map(([group, groupFiles]) => (
        <div key={group} className="mb-3.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
          <h3 className="px-4 pt-3.5 pb-2 text-base font-bold">{group}</h3>
          {groupFiles.map((f) => (
            <div key={f.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5">
              <button type="button" onClick={() => openFile(f.storagePath)} className="flex-1 truncate text-left text-sm font-semibold text-act underline">
                {f.name}
              </button>
              <span className="font-mono text-xs text-muted">{Math.round(f.size / 1024)} Ko</span>
              <button
                type="button"
                onClick={() => deleteFile(f.id, f.storagePath)}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${confirmId === f.id ? "bg-bad text-white" : "bg-bad-bg text-bad"}`}
              >
                {confirmId === f.id ? "Confirmer" : "Supprimer"}
              </button>
            </div>
          ))}
        </div>
      ))}
      {groups.length === 0 && <p className="text-sm text-muted">Le coffre est vide.</p>}
    </div>
  );
}
