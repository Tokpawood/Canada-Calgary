"use client";

import { useState } from "react";
import type { VaultFile } from "@/lib/types";
import { SUGGESTED_FOLDERS, type VaultFolder } from "@/lib/folders";
import { ConfirmButton, EmptyState } from "@/components/ui";
import { FileDropzone, formatSize } from "@/components/FileDropzone";
import { IconChevronLeft, IconFolder, IconFolderPlus, IconPencil, IconPlus, IconTrash } from "@/components/icons";
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
  onCreate: (name: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}

/** Onglet « Dossiers » : classement libre (Bulletins, Reçus de loyer…), chaque dossier = un sous-dossier Drive. */
export function FoldersView(p: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // « Non classés » : ni dossier, ni pièce (les fichiers d'une pièce sont déjà rangés sous « Par pièce »).
  const byFolder = (id: string | null) => p.files.filter((f) => (f.folderId ?? null) === id && (id !== null || !f.documentId));
  const existing = new Set(p.folders.map((f) => f.name.toLowerCase()));
  const suggestions = SUGGESTED_FOLDERS.filter((s) => !existing.has(s.toLowerCase()));

  async function create(n: string) {
    setErr(null);
    const e = await p.onCreate(n);
    if (e) return setErr(e);
    setName("");
    setCreating(false);
  }

  // ---------- Dossier ouvert ----------
  if (p.open) {
    const folder = p.folders.find((f) => f.id === p.open);
    const id = p.open === UNSORTED ? null : (folder?.id ?? null);
    const list = byFolder(id).sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
    const title = folder?.name ?? "Non classés";
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => p.onOpen(null)}>
            <IconChevronLeft size={16} /> Dossiers
          </button>
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
                {list.length} · {formatSize(list.reduce((s, f) => s + f.size, 0))}
              </span>
            </h2>
          )}
          {folder && renaming !== folder.id && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(folder.id)}>
                <IconPencil size={14} /> Renommer
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
        {err && <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{err}</p>}

        <FileDropzone compact busy={p.uploading} progress={p.progress} onFiles={(fl) => p.onUpload(fl, id)} title={`Déposer dans « ${title} »`} />

        {list.length === 0 ? (
          <EmptyState icon={<IconFolder size={20} />} title="Dossier vide">
            {folder ? "Déposez des fichiers ci-dessus, ou classez-y un fichier existant depuis son aperçu (menu « Classer »)." : "Tous les fichiers sont classés."}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {list.map((f) => (
              <FileCard key={f.id} file={f} thumb={p.thumbs[f.id]} doc={p.documentLabel(f)} onOpen={() => p.onOpenFile(f, list)} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ---------- Liste des dossiers ----------
  const unsorted = byFolder(null);
  const tiles = [...p.folders].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((f) => {
          const inside = byFolder(f.id);
          return (
            <li key={f.id}>
              <FolderTile name={f.name} count={inside.length} size={inside.reduce((s, x) => s + x.size, 0)} onClick={() => p.onOpen(f.id)} />
            </li>
          );
        })}
        {unsorted.length > 0 && (
          <li>
            <FolderTile name="Non classés" muted count={unsorted.length} size={unsorted.reduce((s, x) => s + x.size, 0)} onClick={() => p.onOpen(UNSORTED)} />
          </li>
        )}
        <li>
          {creating ? (
            <form
              className="card flex h-full flex-col gap-2 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void create(name);
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="Nom du dossier" className="input h-9 text-[13.5px]" aria-label="Nom du nouveau dossier" />
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm flex-1" disabled={!name.trim()}>
                  Créer
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-full min-h-[112px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line text-[13.5px] font-semibold text-muted hover:border-act/50 hover:text-act"
            >
              <IconFolderPlus size={22} />
              Nouveau dossier
            </button>
          )}
        </li>
      </ul>
      {err && <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{err}</p>}

      {suggestions.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Créer en un toucher</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => void create(s)}>
                <IconPlus size={14} /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[12.5px] text-muted">
        Chaque dossier a son sous-dossier dans Google Drive. Pour classer un fichier déjà déposé, ouvrez son aperçu et choisissez le dossier dans le menu « Classer ».
      </p>
    </div>
  );
}

function FolderTile({ name, count, size, muted, onClick }: { name: string; count: number; size: number; muted?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card group flex h-full min-h-[112px] w-full flex-col justify-between p-4 text-left transition-shadow hover:ring-2 hover:ring-act/30">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${muted ? "bg-surface-2 text-muted" : "bg-act-soft text-act"}`}>
        <IconFolder size={20} />
      </span>
      <span className="mt-3 block min-w-0">
        <span className="block truncate text-[14.5px] font-bold group-hover:text-act">{name}</span>
        <span className="mono block text-[11.5px] text-muted">
          {count} fichier{count > 1 ? "s" : ""}
          {count > 0 && ` · ${formatSize(size)}`}
        </span>
      </span>
    </button>
  );
}
