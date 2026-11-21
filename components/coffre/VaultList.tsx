"use client";

import type { VaultFile } from "@/lib/types";
import { ConfirmButton } from "@/components/ui";
import { formatSize } from "@/components/FileDropzone";
import { IconChevronRight, IconFile, IconFolder, IconImage, IconPaperclip, IconTrash } from "@/components/icons";
import { isPdf } from "./FilePreview";

export type VaultView = "grille" | "liste";
export const VIEW_KEY = "pcc-coffre-view";

const shortDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }) : "");

/** Bascule Grille / Liste, mémorisée sur l'appareil. */
export function ViewToggle({ view, onView }: { view: VaultView; onView: (v: VaultView) => void }) {
  return (
    <div role="group" aria-label="Affichage" className="inline-flex gap-0.5 rounded-xl border border-line bg-surface p-1">
      {(["grille", "liste"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onView(v)}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${view === v ? "bg-act text-act-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
        >
          {v === "grille" ? "Grille" : "Liste"}
        </button>
      ))}
    </div>
  );
}

export interface FolderRow {
  id: string;
  name: string;
  count: number;
  subCount: number;
  size: number;
  /** Fichiers liés à une pièce : conservés si le dossier est supprimé. */
  linked: number;
  muted?: boolean;
  /** Ligne non supprimable (« Non classés »). */
  fixed?: boolean;
}

/** Dossiers en liste : ouverture au toucher, suppression en deux temps. */
export function FolderRows({ rows, onOpen, onDelete }: { rows: FolderRow[]; onOpen: (id: string) => void; onDelete: (id: string) => Promise<void> }) {
  if (!rows.length) return null;
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {rows.map((r) => {
        const removable = r.count - r.linked;
        const confirm = removable > 0 || r.subCount > 0 ? `Supprimer avec ${[removable > 0 && `${removable} fichier${removable > 1 ? "s" : ""}`, r.subCount > 0 && `${r.subCount} sous-dossier${r.subCount > 1 ? "s" : ""}`].filter(Boolean).join(" et ")}` : "Supprimer le dossier";
        return (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <button type="button" onClick={() => onOpen(r.id)} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${r.muted ? "bg-surface-2 text-muted" : "bg-act-soft text-act"}`}>
                <IconFolder size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold group-hover:text-act">{r.name}</span>
                <span className="mono block text-[11.5px] text-muted">
                  {r.count} fichier{r.count > 1 ? "s" : ""}
                  {r.subCount > 0 && ` · ${r.subCount} dossier${r.subCount > 1 ? "s" : ""}`}
                  {r.count > 0 && ` · ${formatSize(r.size)}`}
                </span>
              </span>
              <IconChevronRight size={16} className="shrink-0 text-faint" />
            </button>
            {!r.fixed && (
              <ConfirmButton label={`Supprimer le dossier ${r.name}`} confirmLabel={confirm} onConfirm={() => onDelete(r.id)}>
                <IconTrash size={14} />
              </ConfirmButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Fichiers en liste : nom, pièce liée (modifiable), dossier, taille, date, suppression. */
export function FileRows({
  files,
  documents,
  folderName,
  onOpen,
  onLink,
  onDelete,
}: {
  files: VaultFile[];
  documents: Array<{ id: string; name: string }>;
  folderName: (id: string | null) => string | null;
  onOpen: (f: VaultFile) => void;
  onLink: (f: VaultFile, documentId: string | null) => void;
  onDelete: (f: VaultFile) => void;
}) {
  if (!files.length) return null;
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {files.map((f) => {
        const folder = folderName(f.folderId);
        return (
          <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap sm:px-4">
            <button type="button" onClick={() => onOpen(f)} className="group flex min-w-0 flex-1 basis-full items-center gap-3 text-left sm:basis-auto" title={`Aperçu de ${f.name}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isPdf(f) ? "bg-bad-bg text-bad" : "bg-surface-2 text-muted"}`}>
                {isPdf(f) ? <IconFile size={16} /> : <IconImage size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold group-hover:text-act">{f.name}</span>
                <span className="mono block truncate text-[11.5px] text-muted">
                  {formatSize(f.size)} · {shortDate(f.replacedAt ?? f.uploadedAt)}
                  {folder && ` · ${folder}`}
                </span>
              </span>
            </button>
            <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:w-56 sm:flex-none">
              <IconPaperclip size={14} className={`shrink-0 ${f.documentId ? "text-act" : "text-faint"}`} />
              <span className="sr-only">Pièce liée à {f.name}</span>
              <select
                value={f.documentId ?? ""}
                disabled={Boolean(f.replacedAt)}
                onChange={(e) => onLink(f, e.target.value || null)}
                className={`input h-9 min-w-0 flex-1 py-1 text-[13px] ${f.documentId ? "" : "text-muted"}`}
              >
                <option value="">Non rattaché</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <ConfirmButton label={`Supprimer ${f.name}`} confirmLabel="Supprimer" onConfirm={() => onDelete(f)}>
              <IconTrash size={14} />
            </ConfirmButton>
          </li>
        );
      })}
    </ul>
  );
}
