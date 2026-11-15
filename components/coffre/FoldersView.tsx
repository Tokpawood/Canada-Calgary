"use client";

import { useState } from "react";
import type { VaultFile } from "@/lib/types";
import { SUGGESTED_FOLDERS, canMoveInto, folderChain, folderOptions, type VaultFolder } from "@/lib/folders";
import { ConfirmButton, EmptyState } from "@/components/ui";
import { FileDropzone, formatSize } from "@/components/FileDropzone";
import { IconArrowRight, IconChevronLeft, IconChevronRight, IconFolder, IconFolderPlus, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { FileCard } from "./FileCard";

export const UNSORTED = "__non-classe__";

interface Props {
  folders: VaultFolder[];
  files: VaultFile[];
  thumbs: Record<string, string>;
  documentLabel: (f: VaultFile) => string;
  open: string | null;
  onOpen: (id: string | null) => void;
  onOpenFile: (f: VaultFile, list: VaultFile[]) => void;
  onUpload: (files: FileList, folderId: string | null) => void;
  uploading: boolean;
  progress: number | null;
  progressLabel?: string;
  onCreate: (name: string, parentId: string | null) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onMove: (id: string, parentId: string | null) => Promise<string | null>;
}

/** Onglet « Dossiers » : classement libre avec sous-dossiers ; l'arborescence est reproduite sur Google Drive. */
export function FoldersView(p: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const direct = (id: string | null) => p.files.filter((f) => (f.folderId ?? null) === id && (id !== null || !f.documentId));
  const children = (id: string | null) => p.folders.filter((f) => f.parentId === id).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  // Total d'un dossier, sous-dossiers compris.
  const deep = (id: string): VaultFile[] => [...direct(id), ...children(id).flatMap((c) => deep(c.id))];

  const create = async (name: string, parentId: string | null) => {
    setErr(null);
    const e = await p.onCreate(name, parentId);
    if (e) setErr(e);
    return e;
  };

  const unsortedOpen = p.open === UNSORTED;
  const folder = p.open && !unsortedOpen ? p.folders.find((f) => f.id === p.open) : undefined;
  const current = folder?.id ?? null; // null = racine du Coffre
  const chain = folderChain(p.folders, current);
  const subfolders = unsortedOpen ? [] : children(current);
  const list = p.open ? direct(unsortedOpen ? null : current).sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "")) : [];
  const existing = new Set(subfolders.map((f) => f.name.toLowerCase()));
  const suggestions = !p.open ? SUGGESTED_FOLDERS.filter((s) => !existing.has(s.toLowerCase())) : [];
  const unsorted = direct(null);
  const title = folder?.name ?? (unsortedOpen ? "Non classés" : "Dossiers");

  return (
    <div className="flex flex-col gap-4">
      {p.open && (
        <>
          {/* Fil d'Ariane : Dossiers › Bulletins › 2023 */}
          <nav aria-label="Emplacement" className="flex flex-wrap items-center gap-1 text-[13px]">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => p.onOpen(folder?.parentId ?? null)}>
              <IconChevronLeft size={16} /> Retour
            </button>
            <button type="button" className="rounded-md px-1.5 py-1 font-semibold text-muted hover:text-act" onClick={() => p.onOpen(null)}>
              Dossiers
            </button>
            {chain.slice(0, -1).map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <IconChevronRight size={13} className="text-faint" />
                <button type="button" className="rounded-md px-1.5 py-1 font-semibold text-muted hover:text-act" onClick={() => p.onOpen(c.id)}>
                  {c.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {folder && renaming === folder.id ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const v = new FormData(e.currentTarget).get("n") as string;
                  const er = await p.onRename(folder.id, v);
                  if (er) setErr(er);
                  else setRenaming(null);
                }}
              >
                <input name="n" defaultValue={folder.name} maxLength={80} autoFocus className="input h-9 min-w-0 flex-1 text-[15px] font-bold" aria-label="Nouveau nom du dossier" />
                <button type="submit" className="btn btn-primary btn-sm">
                  Renommer
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(null)}>
                  Annuler
                </button>
              </form>
            ) : (
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-[18px] font-bold">
                <IconFolder size={19} className="shrink-0 text-act" />
                <span className="truncate">{title}</span>
                <span className="mono text-[12.5px] font-normal text-muted">
                  {list.length} fichier{list.length > 1 ? "s" : ""}
                  {subfolders.length > 0 && ` · ${subfolders.length} dossier${subfolders.length > 1 ? "s" : ""}`}
                </span>
              </h2>
            )}
            {folder && renaming !== folder.id && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(folder.id)}>
                  <IconPencil size={14} /> Renommer
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoving(moving === folder.id ? null : folder.id)} aria-expanded={moving === folder.id}>
                  <IconArrowRight size={14} /> Déplacer
                </button>
                <ConfirmButton
                  label={`Supprimer le dossier ${folder.name}`}
                  confirmLabel="Supprimer le dossier"
                  className="btn btn-sm btn-danger"
                  onConfirm={async () => {
                    const er = await p.onDelete(folder.id);
                    if (er) setErr(er);
                  }}
                >
                  <IconTrash size={14} />
                </ConfirmButton>
              </>
            )}
          </div>
        </>
      )}
      {folder && moving === folder.id && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("dest") as string;
            const er = await p.onMove(folder.id, v === "" ? null : v);
            if (er) setErr(er);
            else {
              setErr(null);
              setMoving(null);
            }
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-semibold">
            <span className="shrink-0">Déplacer « {folder.name} » vers</span>
            <select name="dest" defaultValue={folder.parentId ?? ""} className="input h-9 min-w-0 flex-1 text-[13.5px]">
              <option value="">Racine du Coffre</option>
              {folderOptions(p.folders)
                .filter((o) => canMoveInto(p.folders, folder.id, o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            Déplacer
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoving(null)}>
            Annuler
          </button>
        </form>
      )}
      {err && <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{err}</p>}

      {!unsortedOpen && <NewFolder key={current ?? "racine"} label={folder ? "Nouveau sous-dossier" : "Nouveau dossier"} onCreate={(n) => create(n, current)} />}

      {/* Sous-dossiers (ou dossiers de la racine) */}
      {!unsortedOpen && (subfolders.length > 0 || (!p.open && unsorted.length > 0)) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {subfolders.map((f) => {
            const inside = deep(f.id);
            return (
              <li key={f.id}>
                <FolderTile
                  name={f.name}
                  count={inside.length}
                  subCount={children(f.id).length}
                  size={inside.reduce((s, x) => s + x.size, 0)}
                  onClick={() => {
                    setErr(null);
                    p.onOpen(f.id);
                  }}
                />
              </li>
            );
          })}
          {!p.open && unsorted.length > 0 && (
            <li>
              <FolderTile name="Non classés" muted count={unsorted.length} subCount={0} size={unsorted.reduce((s, x) => s + x.size, 0)} onClick={() => p.onOpen(UNSORTED)} />
            </li>
          )}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Créer en un toucher</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => void create(s, null)}>
                <IconPlus size={14} /> {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {p.open && (
        <>
          {!unsortedOpen && (
            <FileDropzone compact busy={p.uploading} progress={p.progress} progressLabel={p.progressLabel} onFiles={(fl) => p.onUpload(fl, current)} title={`Déposer dans « ${title} »`} />
          )}
          {list.length === 0 ? (
            subfolders.length === 0 && (
              <EmptyState icon={<IconFolder size={20} />} title="Dossier vide">
                {folder ? "Déposez des fichiers ci-dessus, créez un sous-dossier, ou classez-y un fichier existant depuis son aperçu." : "Tous les fichiers sont classés."}
              </EmptyState>
            )
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {list.map((f) => (
                <FileCard key={f.id} file={f} thumb={p.thumbs[f.id]} doc={p.documentLabel(f)} onOpen={() => p.onOpenFile(f, list)} />
              ))}
            </ul>
          )}
        </>
      )}

      {!p.open && (
        <p className="text-[12.5px] text-muted">
          Ouvrez un dossier pour y déposer des fichiers ou y créer un sous-dossier (ex. Bulletins › 2023). L&apos;arborescence est reproduite dans Google Drive. Pour classer un fichier déjà déposé, ouvrez son aperçu et choisissez le dossier.
        </p>
      )}
    </div>
  );
}

function NewFolder({ label, onCreate }: { label: string; onCreate: (name: string) => Promise<string | null> }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  if (!creating) {
    return (
      <div>
        <button type="button" onClick={() => setCreating(true)} className="btn btn-ghost btn-sm">
          <IconFolderPlus size={15} /> {label}
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(await onCreate(name))) {
          setName("");
          setCreating(false);
        }
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="Nom du dossier" className="input h-9 w-56 max-w-full text-[13.5px]" aria-label="Nom du nouveau dossier" />
      <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
        Créer
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
        Annuler
      </button>
    </form>
  );
}

function FolderTile({ name, count, subCount, size, muted, onClick }: { name: string; count: number; subCount: number; size: number; muted?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card group flex h-full min-h-[112px] w-full flex-col justify-between p-4 text-left transition-shadow hover:ring-2 hover:ring-act/30">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${muted ? "bg-surface-2 text-muted" : "bg-act-soft text-act"}`}>
        <IconFolder size={20} />
      </span>
      <span className="mt-3 block min-w-0">
        <span className="block truncate text-[14.5px] font-bold group-hover:text-act">{name}</span>
        <span className="mono block text-[11.5px] text-muted">
          {count} fichier{count > 1 ? "s" : ""}
          {subCount > 0 && ` · ${subCount} dossier${subCount > 1 ? "s" : ""}`}
          {count > 0 && ` · ${formatSize(size)}`}
        </span>
      </span>
    </button>
  );
}
