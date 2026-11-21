"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { copyVaultFile, createFolder, linkVaultFile, deleteFolder, deleteVaultFile, fileUrl, moveFolder, moveVaultFile, renameFolder, signFileUrl, uploadMany } from "@/lib/vaultClient";
import { folderOptions, folderPath, type VaultFolder } from "@/lib/folders";
import type { VaultFile } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui";
import { FileDropzone, formatSize } from "@/components/FileDropzone";
import { IconCheck, IconFile, IconFolder, IconImage, IconLock, IconPaperclip, IconRefresh, IconSearch, IconShield, IconUpload } from "@/components/icons";
import { FilterBar, FilterChip, FilterDivider, FilterGroup, FilterSelect } from "@/components/FilterBar";
import { DarkHeader, DarkTiles, HeaderTabs, useHashTab } from "@/components/DarkHeader";

const TABS = ["dossiers", "fichiers", "par-piece", "remplaces", "deposer"] as const;
type Tab = (typeof TABS)[number];
import { FilePreview, isPdf } from "./FilePreview";
import { FileCard } from "./FileCard";
import { FoldersView } from "./FoldersView";
import { StatusMessage } from "./StatusMessage";
import { FileRows, VIEW_KEY, ViewToggle, type VaultView } from "./VaultList";
import { joinUploadErrors, normalizeSearch } from "@/lib/documents";
import { pendingDriveBackup } from "@/lib/vaultStats";

type Kind = "all" | "pdf" | "image";
const UNLINKED = "__divers__";

interface Props {
  initialFiles: VaultFile[];
  /** Pièces de Documents, dans leur ordre : cibles possibles d'un rattachement. */
  documents: Array<{ id: string; name: string }>;
  initialFolders: VaultFolder[];
}

export function VaultBoard({ initialFiles, documents, initialFolders }: Props) {
  const documentNames = useMemo(() => Object.fromEntries(documents.map((d) => [d.id, d.name])) as Record<string, string>, [documents]);
  // Grille ou liste : choix mémorisé sur l'appareil, lu après l'hydratation.
  const [view, setViewState] = useState<VaultView>("grille");
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const v = localStorage.getItem(VIEW_KEY);
        if (v === "grille" || v === "liste") setViewState(v);
      } catch {
        /* stockage indisponible : grille */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  function setView(v: VaultView) {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* rien */
    }
  }
  const [allFiles, setFiles] = useState(initialFiles);
  // Versions actives d'un côté, versions remplacées (archivées sur Drive) de l'autre.
  const files = useMemo(() => allFiles.filter((f) => !f.replacedAt), [allFiles]);
  const replaced = useMemo(() => allFiles.filter((f) => f.replacedAt).sort((a, b) => (b.replacedAt ?? "").localeCompare(a.replacedAt ?? "")), [allFiles]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<Kind>("all");
  const [docFilter, setDocFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [tab, setTab] = useHashTab<Tab>(TABS, "dossiers");
  const [folders, setFolders] = useState(initialFolders);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dropFolder, setDropFolder] = useState<string>("");
  // Liste parcourue par l'aperçu quand il est ouvert depuis un dossier.
  const [previewScope, setPreviewScope] = useState<VaultFile[] | null>(null);
  const [uploadCount, setUploadCount] = useState<{ done: number; total: number } | null>(null);
  // « Bulletins › 2023 » : chemin complet d'un dossier.
  const folderName = useCallback((id: string | null) => folderPath(folders, id), [folders]);
  const choices = useMemo(() => folderOptions(folders), [folders]);

  const documentLabel = useCallback((f: VaultFile) => (f.documentId ? (documentNames[f.documentId] ?? "Document") : "Non rattaché"), [documentNames]);

  const signUrl = signFileUrl;

  // Vignettes des images : lues via l'application (Google Drive), après contrôle d'accès.
  const thumbs = useMemo(() => Object.fromEntries(allFiles.filter((f) => !isPdf(f)).map((f) => [f.id, fileUrl(f)])), [allFiles]);

  const sorted = useMemo(() => [...files].sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "")), [files]);

  const docOptions = useMemo(() => {
    const ids = new Set(files.map((f) => f.documentId ?? UNLINKED));
    return Array.from(ids)
      .map((id) => ({ id, label: id === UNLINKED ? "Non rattachés" : (documentNames[id] ?? "Document") }))
      .sort((a, b) => (a.id === UNLINKED ? 1 : b.id === UNLINKED ? -1 : a.label.localeCompare(b.label, "fr")));
  }, [files, documentNames]);

  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    return sorted.filter((f) => {
      if (kind === "pdf" && !isPdf(f)) return false;
      if (kind === "image" && isPdf(f)) return false;
      if (docFilter !== "all" && (f.documentId ?? UNLINKED) !== docFilter) return false;
      if (q && !normalizeSearch(`${f.name} ${documentLabel(f)} ${folderName(f.folderId) ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [sorted, kind, docFilter, query, documentLabel, folderName]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const pdfCount = files.filter(isPdf).length;
  const previewList = useMemo(() => {
    if (tab === "remplaces") return replaced;
    if (previewScope) return previewScope.map((f) => files.find((x) => x.id === f.id)).filter((f): f is VaultFile => Boolean(f));
    return visible;
  }, [tab, replaced, previewScope, files, visible]);
  const previewIndex = previewId ? previewList.findIndex((f) => f.id === previewId) : -1;

  async function handleUpload(fileList: FileList, folderId: string | null = null) {
    setUploading(true);
    setError(null);
    setNotice(null);
    const list = Array.from(fileList);
    const pct = new Map<File, number>();
    const failed: string[] = [];
    const swapped: string[] = [];
    let added = 0;
    let finished = 0;
    setProgress(0);
    setUploadCount({ done: 0, total: list.length });
    await uploadMany(
      list,
      { folderId },
      (file, res) => {
        finished += 1;
        setUploadCount({ done: finished, total: list.length });
        if (res.error || !res.file) {
          failed.push(`${file.name} : ${res.error ?? "fichier refusé."}`);
          return;
        }
        const saved = res.file;
        const old = res.replaced ?? null;
        setFiles((prev) => [...prev.filter((x) => x.id !== old?.id), ...(old ? [old] : []), saved]);
        if (old) swapped.push(saved.name);
        added += 1;
      },
      (file, p) => {
        pct.set(file, p);
        setProgress([...pct.values()].reduce((a, b) => a + b, 0) / list.length);
      },
    );
    setUploading(false);
    setProgress(null);
    setUploadCount(null);
    if (failed.length) setError(joinUploadErrors(failed, 4));
    const parts = [`${added} fichier${added > 1 ? "s" : ""} envoyé${added > 1 ? "s" : ""}${folderId ? ` dans « ${folderName(folderId)} »` : ""}.`];
    if (swapped.length) parts.push(`${swapped.join(", ")} : nouvelle version enregistrée, l'ancienne est conservée dans « Remplacés ».`);
    if (added) setNotice(parts.join(" "));
    // Dépôt depuis l'onglet Déposer : on montre le dossier (ou la grille) qui l'a reçu.
    if (added > 0 && tab === "deposer") {
      if (folderId) {
        setOpenFolder(folderId);
        setTab("dossiers");
      } else setTab("fichiers");
    }
  }

  async function moveFile(f: VaultFile, folderId: string | null): Promise<boolean> {
    setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, folderId } : x)));
    const res = await moveVaultFile(f.id, folderId);
    if (res.error) {
      setError(`${f.name} : ${res.error}`);
      setFiles((prev) => prev.map((x) => (x.id === f.id ? f : x)));
      return false;
    }
    setNotice(`${f.name} classé ${folderId ? `dans « ${folderName(folderId)} »` : "hors dossier"}${f.documentId ? " ; il reste lié à sa pièce dans Documents" : ""}.`);
    return true;
  }

  async function linkFile(f: VaultFile, documentId: string | null): Promise<boolean> {
    if ((f.documentId ?? null) === documentId) return true;
    setError(null);
    setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, documentId } : x)));
    const res = await linkVaultFile(f.id, documentId);
    if (!res.file) {
      setError(`${f.name} : ${res.error}`);
      setFiles((prev) => prev.map((x) => (x.id === f.id ? f : x)));
      return false;
    }
    const saved = res.file;
    setFiles((prev) => prev.map((x) => (x.id === f.id ? saved : x)));
    setNotice(documentId ? `${f.name} est maintenant joint à « ${documentNames[documentId] ?? "la pièce"} » dans Documents.` : `${f.name} n'est plus rattaché à une pièce.`);
    return true;
  }

  async function copyFile(f: VaultFile, folderId: string | null): Promise<boolean> {
    const res = await copyVaultFile(f.id, folderId);
    if (!res.file) {
      setError(`${f.name} : ${res.error ?? "copie refusée"}`);
      return false;
    }
    const copy = res.file;
    const old = res.replaced;
    setFiles((prev) => [copy, ...prev.map((x) => (old && x.id === old.id ? old : x))]);
    setNotice(`Copie de ${f.name} ajoutée ${folderId ? `dans « ${folderName(folderId)} »` : "hors dossier"} ; l'original ne bouge pas.`);
    return true;
  }

  /** Plusieurs fichiers déplacés ou copiés vers un dossier, depuis le sélecteur de pièces jointes. */
  async function bringFiles(list: VaultFile[], folderId: string, mode: "move" | "copy") {
    setError(null);
    let done = 0;
    for (const f of list) if (await (mode === "move" ? moveFile(f, folderId) : copyFile(f, folderId))) done += 1;
    if (done > 1) setNotice(`${done} fichiers ${mode === "move" ? "rangés" : "copiés"} dans « ${folderName(folderId)} »${mode === "move" ? " ; ils restent liés à leurs pièces" : ""}.`);
  }

  async function addFolder(name: string, parentId: string | null): Promise<string | null> {
    const res = await createFolder(name, parentId);
    if (!res.folder) return res.error ?? "Création impossible.";
    const created = res.folder;
    setFolders((prev) => [...prev, created]);
    return null;
  }

  async function editFolder(id: string, name: string): Promise<string | null> {
    const res = await renameFolder(id, name);
    if (!res.folder) return res.error ?? "Renommage impossible.";
    const renamed = res.folder;
    setFolders((prev) => prev.map((f) => (f.id === id ? renamed : f)));
    return null;
  }

  async function relocateFolder(id: string, parentId: string | null): Promise<string | null> {
    const res = await moveFolder(id, parentId);
    if (!res.folder) return res.error ?? "Déplacement impossible.";
    const moved = res.folder;
    setFolders((prev) => prev.map((f) => (f.id === id ? moved : f)));
    setNotice(`Dossier « ${moved.name} » déplacé ${parentId ? `dans « ${folderPath(folders, parentId)} »` : "à la racine du Coffre"}.`);
    return null;
  }

  async function removeFolder(id: string): Promise<string | null> {
    const name = folders.find((f) => f.id === id)?.name ?? "dossier";
    const res = await deleteFolder(id);
    if (res.error) return res.error;
    const goneFolders = new Set(res.deletedFolders);
    const goneFiles = new Set(res.deletedFiles);
    // Retour au dossier parent si l'on était dedans.
    if (openFolder && goneFolders.has(openFolder)) setOpenFolder(folders.find((f) => f.id === id)?.parentId ?? null);
    setFolders((prev) => prev.filter((f) => !goneFolders.has(f.id)));
    // Fichiers liés à une pièce : conservés, désormais non classés.
    setFiles((prev) => prev.filter((f) => !goneFiles.has(f.id)).map((f) => (f.folderId && goneFolders.has(f.folderId) ? { ...f, folderId: null } : f)));
    const kept = files.filter((f) => f.folderId && goneFolders.has(f.folderId) && f.documentId).length;
    setNotice(
      `Dossier « ${name} » supprimé${goneFiles.size ? ` avec ${goneFiles.size} fichier${goneFiles.size > 1 ? "s" : ""} (corbeille Google Drive, récupérables 30 jours)` : ""}.${kept ? ` ${kept} fichier${kept > 1 ? "s" : ""} lié${kept > 1 ? "s" : ""} à une pièce ${kept > 1 ? "sont conservés" : "est conservé"} dans « Non classés ».` : ""}`,
    );
    return null;
  }

  function openPreview(f: VaultFile) {
    setPreviewScope(null);
    setPreviewId(f.id);
  }

  async function deleteFile(f: VaultFile) {
    // Dans l'aperçu, on passe au fichier voisin avant de retirer celui-ci.
    if (previewId === f.id) {
      const next = previewList[previewIndex + 1] ?? previewList[previewIndex - 1];
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
  const pendingBackup = pendingDriveBackup(files);
  const groups = useMemo(
    () =>
      docOptions.map((o) => ({ ...o, files: sorted.filter((f) => (f.documentId ?? UNLINKED) === o.id) })).filter((g) => g.files.length > 0),
    [docOptions, sorted],
  );
  const lastUpload = sorted[0]?.uploadedAt;
  const countLabel = uploadCount ? `${uploadCount.done} fichier${uploadCount.done > 1 ? "s" : ""} sur ${uploadCount.total} terminé${uploadCount.done > 1 ? "s" : ""}` : undefined;

  const dropAside = (
    <aside className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-muted">
        Ranger dans
        <select value={dropFolder} onChange={(e) => setDropFolder(e.target.value)} className="input h-10 text-[14px] text-ink">
          <option value="">Aucun dossier (non classé)</option>
          {choices.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <FileDropzone busy={uploading} progress={progress} progressLabel={countLabel} onFiles={(fl) => void handleUpload(fl, dropFolder || null)} title="Déposer des fichiers" />
      {error && (
        <StatusMessage tone="bad" onDismiss={() => setError(null)}>
          {error}
        </StatusMessage>
      )}
      {notice && (
        <StatusMessage tone="ok" onDismiss={() => setNotice(null)}>
          {notice}
        </StatusMessage>
      )}
      <div className="card p-4 text-[12.5px] text-muted shadow-none">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <IconShield size={15} className="text-act" /> Bon à savoir
        </p>
        <p className="mt-1.5">Les fichiers sont d&apos;abord enregistrés dans l&apos;application (plusieurs à la fois, avec barre d&apos;avancement), puis copiés automatiquement sur Google Drive en sauvegarde. Les photos de plus de 2,5 Mo sont réduites avant l&apos;envoi (toujours lisibles) ; les PDF sont envoyés tels quels.</p>
        <p className="mt-1.5">Un fichier déposé ici n&apos;est rattaché à aucune pièce. Pour le lier au passeport, au diplôme, etc., choisissez la pièce dans son aperçu ou dans l&apos;affichage en liste ; il apparaît alors sur sa fiche dans Documents.</p>
        <p className="mt-1.5">Un fichier joint à une pièce peut aussi être rangé dans un dossier (il reste lié à sa pièce) ou copié dans un dossier : depuis son aperçu, ou avec « Ajouter des pièces jointes » dans un dossier ouvert.</p>
        <p className="mt-1.5">Même nom sur la même pièce : la nouvelle version remplace l&apos;ancienne, qui reste conservée dans « Remplacés » (dossier Drive « Fichiers remplacés »).</p>
        <p className="mt-1.5">Le type réel est vérifié avant l&apos;envoi : un fichier renommé en .pdf est refusé.</p>      </div>
    </aside>
  );

  return (
    <>
      <PageHeader
        title="Coffre"
        description="Vos scans sont enregistrés dans l'application et sauvegardés automatiquement dans votre Google Drive. Accès réservé au titulaire."
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
              { id: "dossiers", label: "Dossiers", icon: <IconFolder size={15} />, badge: folders.length ? { text: String(folders.length) } : null },
              { id: "fichiers", label: "Fichiers", icon: <IconImage size={15} />, badge: { text: String(files.length) } },
              { id: "par-piece", label: "Par pièce", icon: <IconPaperclip size={15} />, badge: groups.length ? { text: String(groups.length) } : null },
              { id: "remplaces", label: "Remplacés", icon: <IconRefresh size={15} />, badge: replaced.length ? { text: String(replaced.length) } : null },
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
            {
              icon: <IconLock size={13} />,
              text: pendingBackup.length
                ? `${pendingBackup.length} sauvegarde${pendingBackup.length > 1 ? "s" : ""} Drive en cours`
                : files.length
                  ? "Tout est sauvegardé sur Google Drive"
                  : "Sauvegarde sur Google Drive",
            },
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
      {(error || notice) && tab !== "deposer" && (
        <div className="mb-4 flex flex-col gap-2">
          {error && (
            <StatusMessage tone="bad" onDismiss={() => setError(null)}>
              {error}
            </StatusMessage>
          )}
          {notice && (
            <StatusMessage tone="ok" onDismiss={() => setNotice(null)}>
              {notice}
            </StatusMessage>
          )}
        </div>
      )}
      {tab === "dossiers" && (
        <FoldersView
          folders={folders}
          files={files}
          thumbs={thumbs}
          documentLabel={documentLabel}
          open={openFolder}
          onOpen={setOpenFolder}
          onOpenFile={(f, list) => {
            setPreviewScope(list);
            setPreviewId(f.id);
          }}
          onUpload={(fl, id) => void handleUpload(fl, id)}
          uploading={uploading}
          progress={progress}
          progressLabel={countLabel}
          onCreate={addFolder}
          onRename={editFolder}
          onDelete={removeFolder}
          onMove={relocateFolder}
          onBring={(list, id, mode) => bringFiles(list, id, mode)}
          view={view}
          onView={setView}
          documents={documents}
          folderName={folderName}
          onLink={(f, docId) => void linkFile(f, docId)}
          onDeleteFile={(f) => void deleteFile(f)}
        />
      )}
      {tab === "deposer" && <div className="mx-auto max-w-2xl">{dropAside}</div>}

      {tab === "remplaces" &&
        (replaced.length === 0 ? (
          <EmptyState icon={<IconRefresh size={20} />} title="Aucun fichier remplacé">
            Quand vous redéposez un fichier du même nom sur la même pièce, l&apos;ancienne version est conservée ici.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-[12.5px] text-muted">Anciennes versions, conservées dans le dossier Drive « Fichiers remplacés ». Elles ne comptent plus dans les pièces du dossier.</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {replaced.map((f) => (
                <FileCard key={f.id} file={f} thumb={thumbs[f.id]} doc={documentLabel(f)} folder={folderName(f.folderId)} onOpen={() => openPreview(f)} />
              ))}
            </ul>
          </>
        ))}

      {tab === "par-piece" &&
        (groups.length === 0 ? (
          <EmptyState icon={<IconLock size={20} />} title="Le coffre est vide">
            Déposez un premier scan pour le retrouver ici, classé par pièce.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ViewToggle view={view} onView={setView} />
            </div>
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
                {view === "liste" ? (
                  <div className="px-4 pb-4 sm:px-5">
                    <FileRows files={g.files} documents={documents} folderName={folderName} onOpen={openPreview} onLink={(f, d) => void linkFile(f, d)} onDelete={(f) => void deleteFile(f)} />
                  </div>
                ) : (
                <ul className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-5 xl:grid-cols-5">
                  {g.files.map((f) => (
                    <FileCard
                      key={f.id}
                      file={f}
                      thumb={thumbs[f.id]}
                      doc={documentLabel(f)}
                      folder={folderName(f.folderId)}
                      onOpen={() => {
                        setKind("all");
                        setDocFilter("all");
                        setQuery("");
                        openPreview(f);
                      }}
                    />
                  ))}
                </ul>
                )}
              </section>
            ))}
          </div>
        ))}

      {tab === "fichiers" && (
      <div className={files.length === 0 ? "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" : ""}>
        <div className="min-w-0">
          {files.length > 0 && (
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex justify-end">
                <ViewToggle view={view} onView={setView} />
              </div>
              <FilterBar
                query={query}
                onQuery={setQuery}
                placeholder="Rechercher par fichier, pièce ou dossier…"
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
          ) : view === "liste" ? (
            <FileRows files={visible} documents={documents} folderName={folderName} onOpen={openPreview} onLink={(f, d) => void linkFile(f, d)} onDelete={(f) => void deleteFile(f)} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {visible.map((f) => (
                <FileCard key={f.id} file={f} thumb={thumbs[f.id]} doc={documentLabel(f)} folder={folderName(f.folderId)} onOpen={() => openPreview(f)} />
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
          files={previewList}
          index={previewIndex}
          documentLabel={documentLabel}
          signUrl={signUrl}
          onIndex={(i) => setPreviewId(previewList[i]?.id ?? null)}
          onDelete={(f) => void deleteFile(f)}
          onClose={() => {
            setPreviewId(null);
            setPreviewScope(null);
          }}
          folders={choices.map((c) => ({ id: c.id, name: c.label }))}
          onMove={(f, id) => void moveFile(f, id)}
          onCopy={(f, id) => void copyFile(f, id)}
          documents={documents}
          onLink={(f, id) => void linkFile(f, id)}
        />
      )}
    </>
  );
}
