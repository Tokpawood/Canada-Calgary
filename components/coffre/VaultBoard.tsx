"use client";

import { useCallback, useMemo, useState } from "react";
import { deleteVaultFile, fileUrl, signFileUrl, uploadVaultFile } from "@/lib/vaultClient";
import type { VaultFile } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui";
import { FileDropzone, formatSize } from "@/components/FileDropzone";
import { IconCheck, IconFile, IconImage, IconLock, IconPaperclip, IconSearch, IconShield, IconUpload } from "@/components/icons";
import { FilterBar, FilterChip, FilterDivider, FilterGroup, FilterSelect } from "@/components/FilterBar";
import { DarkHeader, DarkTiles, HeaderTabs, useHashTab } from "@/components/DarkHeader";

const TABS = ["fichiers", "par-piece", "deposer"] as const;
type Tab = (typeof TABS)[number];
import { FilePreview, fileKind, isPdf } from "./FilePreview";

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
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [tab, setTab] = useHashTab<Tab>(TABS, "fichiers");

  const documentLabel = useCallback((f: VaultFile) => (f.documentId ? (documentNames[f.documentId] ?? "Document") : "Non rattaché"), [documentNames]);

  const signUrl = signFileUrl;

  // Vignettes des images : lues via l'application (Google Drive), après contrôle d'accès.
  const thumbs = useMemo(() => Object.fromEntries(files.filter((f) => !isPdf(f)).map((f) => [f.id, fileUrl(f)])), [files]);

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
  const previewIndex = previewId ? visible.findIndex((f) => f.id === previewId) : -1;

  async function handleUpload(fileList: FileList) {
    setUploading(true);
    setError(null);
    let added = 0;
    for (const file of Array.from(fileList)) {
      const res = await uploadVaultFile(file, null);
      if (res.error || !res.file) {
        setError(`${file.name} : ${res.error ?? "fichier refusé."}`);
        continue;
      }
      const saved = res.file;
      setFiles((prev) => [...prev, saved]);
      added += 1;
    }
    setUploading(false);
    // Après un dépôt réussi, on montre le fichier dans la grille.
    if (added > 0) setTab("fichiers");
  }

  async function deleteFile(f: VaultFile) {
    // Dans l'aperçu, on passe au fichier voisin avant de retirer celui-ci.
    if (previewId === f.id) {
      const next = visible[previewIndex + 1] ?? visible[previewIndex - 1];
      setPreviewId(next ? next.id : null);
    }
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    const err = await deleteVaultFile(f.id);
    if (err) {
      setError(`${f.name} : ${err}`);
      setFiles((prev) => [...prev, f]);
    }
  }

  const linked = files.filter((f) => f.documentId).length;
  const groups = useMemo(
    () =>
      docOptions.map((o) => ({ ...o, files: sorted.filter((f) => (f.documentId ?? UNLINKED) === o.id) })).filter((g) => g.files.length > 0),
    [docOptions, sorted],
  );
  const lastUpload = sorted[0]?.uploadedAt;

  const dropAside = (
    <aside className="flex flex-col gap-4">
      <FileDropzone busy={uploading} onFiles={handleUpload} title="Déposer un fichier" />
      {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{error}</p>}
      <div className="card p-4 text-[12.5px] text-muted shadow-none">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <IconShield size={15} className="text-act" /> Bon à savoir
        </p>
        <p className="mt-1.5">Un fichier déposé ici n&apos;est rattaché à aucune pièce. Pour le lier au passeport, au diplôme, etc., déposez-le depuis sa fiche dans Documents.</p>
        <p className="mt-1.5">Le type réel est vérifié avant l&apos;envoi : un fichier renommé en .pdf est refusé.</p>      </div>
    </aside>
  );

  return (
    <>
      <PageHeader
        title="Coffre"
        description="Vos scans sont enregistrés dans votre Google Drive. Chaque aperçu ou téléchargement passe par l'application, réservée au titulaire."
        actions={
          <button type="button" onClick={() => setTab("deposer")} className="btn btn-primary">
            <IconUpload size={16} /> Déposer
          </button>
        }
      />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              { label: "Rattachés", value: String(linked), unit: `/ ${files.length}`, sub: "liés à une pièce", pct: files.length ? (linked / files.length) * 100 : 0, tone: "ok" },
              {
                label: "Dernier dépôt",
                value: lastUpload ? new Date(lastUpload).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—",
                sub: sorted[0]?.name ?? "aucun fichier",
              },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Sections du coffre"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "fichiers", label: "Fichiers", icon: <IconImage size={15} />, badge: { text: String(files.length) } },
              { id: "par-piece", label: "Par pièce", icon: <IconPaperclip size={15} />, badge: groups.length ? { text: String(groups.length) } : null },
              { id: "deposer", label: "Déposer", icon: <IconUpload size={15} /> },
            ]}
          />
        }
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          <IconLock size={13} /> Google Drive
        </p>
        <p className="mt-1 font-display text-[52px] leading-none font-extrabold tracking-tight">
          {files.length}
          <span className="ml-2 text-[20px] font-bold text-signal">fichier{files.length > 1 ? "s" : ""}</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          {formatSize(totalSize)} · {pdfCount} PDF · {files.length - pdfCount} image{files.length - pdfCount > 1 ? "s" : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { icon: <IconShield size={13} />, text: "Accès réservé au titulaire" },
            { icon: <IconLock size={13} />, text: "Stocké sur Google Drive" },
            { icon: <IconCheck size={13} />, text: "Type réel vérifié" },
          ].map((p) => (
            <span key={p.text} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[12px] font-semibold">
              {p.icon}
              {p.text}
            </span>
          ))}
        </div>
      </DarkHeader>

      <div className="mt-5" role="tabpanel">
      {tab === "deposer" && <div className="mx-auto max-w-2xl">{dropAside}</div>}

      {tab === "par-piece" &&
        (groups.length === 0 ? (
          <EmptyState icon={<IconLock size={20} />} title="Le coffre est vide">
            Déposez un premier scan pour le retrouver ici, classé par pièce.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <section key={g.id} className="card overflow-hidden">
                <div className="flex items-center gap-3 px-4 pt-4 pb-3 sm:px-5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${g.id === UNLINKED ? "bg-surface-2 text-muted" : "bg-act-soft text-act"}`}>
                    <IconPaperclip size={15} />
                  </span>
                  <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold">{g.label}</h2>
                  <span className="mono text-[12px] text-muted">
                    {g.files.length} · {formatSize(g.files.reduce((s, f) => s + f.size, 0))}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-5 xl:grid-cols-5">
                  {g.files.map((f) => (
                    <FileCard
                      key={f.id}
                      file={f}
                      thumb={thumbs[f.id]}
                      doc={documentLabel(f)}
                      onOpen={() => {
                        setKind("all");
                        setDocFilter("all");
                        setQuery("");
                        setPreviewId(f.id);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}

      {tab === "fichiers" && (
      <div className={files.length === 0 ? "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" : ""}>
        <div className="min-w-0">
          {files.length > 0 && (
            <div className="mb-4">
              <FilterBar
                query={query}
                onQuery={setQuery}
                placeholder="Rechercher par nom de fichier ou de pièce…"
                searchLabel="Rechercher un fichier"
                meta={visible.length === files.length ? `${files.length} fichier${files.length > 1 ? "s" : ""} · ${formatSize(totalSize)}` : `${visible.length} sur ${files.length}`}
                onReset={kind !== "all" || docFilter !== "all" || query ? () => {
                  setKind("all");
                  setDocFilter("all");
                  setQuery("");
                } : undefined}
              >
                <FilterGroup label="Type de fichier">
                  <FilterChip active={kind === "all"} onClick={() => setKind("all")} label="Tous" count={files.length} />
                  <FilterChip active={kind === "pdf"} onClick={() => setKind("pdf")} label="PDF" count={pdfCount} icon={<IconFile size={13} />} />
                  <FilterChip active={kind === "image"} onClick={() => setKind("image")} label="Images" count={files.length - pdfCount} icon={<IconImage size={13} />} />
                </FilterGroup>
                <FilterDivider />
                <FilterSelect
                  label="Filtrer par pièce"
                  value={docFilter}
                  onChange={setDocFilter}
                  icon={<IconPaperclip size={13} />}
                  options={[{ value: "all", label: "Toutes les pièces" }, ...docOptions.map((o) => ({ value: o.id, label: o.label }))]}
                />
              </FilterBar>
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
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {visible.map((f) => (
                <FileCard key={f.id} file={f} thumb={thumbs[f.id]} doc={documentLabel(f)} onOpen={() => setPreviewId(f.id)} />
              ))}
            </ul>
          )}
        </div>
        {files.length === 0 && dropAside}
      </div>
      )}
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
