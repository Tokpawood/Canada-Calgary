"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapVaultFile } from "@/lib/queries";
import { validateVaultFile } from "@/lib/fileSniff";
import type { VaultFile } from "@/lib/types";
import { timestamp } from "@/lib/ids";
import { EmptyState, PageHeader, Segmented } from "@/components/ui";
import { FileDropzone, formatSize } from "@/components/FileDropzone";
import { IconFile, IconImage, IconLock, IconSearch, IconShield } from "@/components/icons";
import { FilePreview, fileKind, isPdf } from "./FilePreview";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

type Kind = "all" | "pdf" | "image";
const UNLINKED = "__divers__";

interface Props {
  dossierId: string;
  initialFiles: VaultFile[];
  documentNames: Record<string, string>;
}

export function VaultBoard({ dossierId, initialFiles, documentNames }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<Kind>("all");
  const [docFilter, setDocFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const documentLabel = useCallback((f: VaultFile) => (f.documentId ? (documentNames[f.documentId] ?? "Document") : "Non rattaché"), [documentNames]);

  const signUrl = useCallback(
    async (f: VaultFile, download = false) => {
      const { data } = await supabase.storage.from("coffre").createSignedUrl(f.storagePath, 300, download ? { download: f.name } : undefined);
      return data?.signedUrl ?? null;
    },
    [supabase],
  );

  // Vignettes des images : liens signés de 5 minutes, demandés en une fois pour les fichiers qui n'en ont pas encore.
  useEffect(() => {
    const missing = files.filter((f) => !isPdf(f) && !thumbs[f.id]);
    if (missing.length === 0) return;
    let alive = true;
    void supabase.storage
      .from("coffre")
      .createSignedUrls(
        missing.map((f) => f.storagePath),
        300,
      )
      .then(({ data }) => {
        if (!alive || !data) return;
        const next: Record<string, string> = {};
        data.forEach((d, i) => {
          if (d.signedUrl) next[missing[i].id] = d.signedUrl;
        });
        setThumbs((t) => ({ ...t, ...next }));
      });
    return () => {
      alive = false;
    };
  }, [files, thumbs, supabase]);

  const sorted = useMemo(() => [...files].sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "")), [files]);

  const docOptions = useMemo(() => {
    const ids = new Set(files.map((f) => f.documentId ?? UNLINKED));
    return Array.from(ids)
      .map((id) => ({ id, label: id === UNLINKED ? "Non rattachés" : (documentNames[id] ?? "Document") }))
      .sort((a, b) => (a.id === UNLINKED ? 1 : b.id === UNLINKED ? -1 : a.label.localeCompare(b.label, "fr")));
  }, [files, documentNames]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((f) => {
      if (kind === "pdf" && !isPdf(f)) return false;
      if (kind === "image" && isPdf(f)) return false;
      if (docFilter !== "all" && (f.documentId ?? UNLINKED) !== docFilter) return false;
      if (q && !`${f.name} ${documentLabel(f)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, kind, docFilter, query, documentLabel]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const pdfCount = files.filter(isPdf).length;
  const linked = files.filter((f) => f.documentId).length;
  const previewIndex = previewId ? visible.findIndex((f) => f.id === previewId) : -1;

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

  async function deleteFile(f: VaultFile) {
    // Dans l'aperçu, on passe au fichier voisin avant de retirer celui-ci.
    if (previewId === f.id) {
      const next = visible[previewIndex + 1] ?? visible[previewIndex - 1];
      setPreviewId(next ? next.id : null);
    }
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    await Promise.all([supabase.storage.from("coffre").remove([f.storagePath]), supabase.from("file").delete().eq("id", f.id)]);
  }

  return (
    <>
      <PageHeader
        title="Coffre"
        description="Vos scans dans un stockage privé. Chaque aperçu ou téléchargement passe par un lien sécurisé valable 5 minutes."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Fichiers" value={String(files.length)} />
        <Stat label="Espace utilisé" value={formatSize(totalSize)} />
        <Stat label="PDF · images" value={`${pdfCount} · ${files.length - pdfCount}`} />
        <Stat label="Rattachés à une pièce" value={`${linked} / ${files.length}`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {files.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Segmented<Kind>
                label="Type de fichier"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: "Tous", count: files.length },
                  { value: "pdf", label: "PDF", count: pdfCount },
                  { value: "image", label: "Images", count: files.length - pdfCount },
                ]}
              />
              <select value={docFilter} onChange={(e) => setDocFilter(e.target.value)} aria-label="Filtrer par pièce" className="input w-auto max-w-[220px] py-1.5 text-[13px]">
                <option value="all">Toutes les pièces</option>
                {docOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[180px] flex-1">
                <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un fichier…" aria-label="Rechercher un fichier" className="input pl-9" />
              </div>
            </div>
          )}

          {files.length === 0 ? (
            <EmptyState icon={<IconLock size={20} />} title="Le coffre est vide">
              Déposez un scan ci-contre, ou depuis la fiche d&apos;un document pour le lui rattacher.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState icon={<IconSearch size={20} />} title="Aucun fichier ne correspond">
              Changez de filtre ou de recherche.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {visible.map((f) => (
                <FileCard key={f.id} file={f} thumb={thumbs[f.id]} doc={documentLabel(f)} onOpen={() => setPreviewId(f.id)} />
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <FileDropzone busy={uploading} onFiles={handleUpload} title="Déposer un fichier" />
          {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{error}</p>}
          <div className="card p-4 text-[12.5px] text-muted shadow-none">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <IconShield size={15} className="text-act" /> Bon à savoir
            </p>
            <p className="mt-1.5">Un fichier déposé ici n&apos;est rattaché à aucune pièce. Pour le lier au passeport, au diplôme, etc., déposez-le depuis sa fiche dans Documents.</p>
            <p className="mt-1.5">Le type réel est vérifié avant l&apos;envoi : un fichier renommé en .pdf est refusé.</p>
          </div>
        </aside>
      </div>

      {previewIndex >= 0 && (
        <FilePreview
          files={visible}
          index={previewIndex}
          documentLabel={documentLabel}
          signUrl={signUrl}
          onIndex={(i) => setPreviewId(visible[i]?.id ?? null)}
          onDelete={(f) => void deleteFile(f)}
          onClose={() => setPreviewId(null)}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mono mt-0.5 text-[20px] font-semibold">{value}</p>
    </div>
  );
}

function FileCard({ file, thumb, doc, onOpen }: { file: VaultFile; thumb?: string; doc: string; onOpen: () => void }) {
  const pdf = isPdf(file);
  return (
    <li>
      <button type="button" onClick={onOpen} className="card group flex w-full flex-col overflow-hidden text-left transition-shadow hover:ring-2 hover:ring-act/30" title={`Aperçu de ${file.name}`}>
        <span className="relative block aspect-[4/3] w-full overflow-hidden border-b border-line bg-surface-2">
          {pdf ? (
            <span className="absolute inset-0 grid place-items-center">
              <span className="relative grid h-[68%] aspect-[3/4] place-items-center rounded-md border border-line bg-surface shadow-sm transition-transform group-hover:-translate-y-0.5">
                <span className="absolute inset-x-[18%] top-[18%] flex flex-col gap-1.5" aria-hidden>
                  <span className="h-1 rounded-full bg-line" />
                  <span className="h-1 w-4/5 rounded-full bg-line" />
                  <span className="h-1 rounded-full bg-line" />
                  <span className="h-1 w-3/5 rounded-full bg-line" />
                </span>
                <span className="mono absolute bottom-[14%] rounded bg-bad px-1.5 py-0.5 text-[10px] font-bold text-white">PDF</span>
              </span>
            </span>
          ) : thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- vignette servie par lien signé temporaire
            <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-faint">
              <IconImage size={26} />
            </span>
          )}
          <span className="mono absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">{fileKind(file)}</span>
        </span>
        <span className="block min-w-0 px-3 py-2.5">
          <span className="block truncate text-[13px] font-semibold group-hover:text-act">{file.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
            {pdf ? <IconFile size={12} className="shrink-0" /> : <IconImage size={12} className="shrink-0" />}
            <span className="truncate">{doc}</span>
          </span>
          <span className="mono mt-0.5 block text-[11px] text-faint">
            {formatSize(file.size)}
            {file.uploadedAt && ` · ${new Date(file.uploadedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
          </span>
        </span>
      </button>
    </li>
  );
}
