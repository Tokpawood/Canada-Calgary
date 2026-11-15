"use client";

import { useRef, useState } from "react";
import type { VaultFile } from "@/lib/types";
import { ConfirmButton } from "./ui";
import { IconFile, IconImage, IconTrash, IconUpload } from "./icons";

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export function VaultFileRow({ file, onOpen, onDelete }: { file: VaultFile; onOpen: () => void; onDelete: () => void }) {
  const isPdf = file.mime === "application/pdf";
  const date = file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <li className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 hover:border-act/40">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isPdf ? "bg-bad-bg text-bad" : "bg-run-bg text-run"}`}>
        {isPdf ? <IconFile size={17} /> : <IconImage size={17} />}
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" title="Aperçu (lu depuis Google Drive)">
        <span className="block truncate text-[13.5px] font-semibold hover:text-act hover:underline">{file.name}</span>
        <span className="mono block text-[11px] text-faint">
          {isPdf ? "PDF" : file.mime.replace("image/", "").toUpperCase()} · {formatSize(file.size)}
          {date && ` · ${date}`}
        </span>
      </button>
      <ConfirmButton label={`Supprimer ${file.name}`} onConfirm={onDelete} className="btn btn-sm btn-danger opacity-70 group-hover:opacity-100 data-[armed=true]:opacity-100">
        <IconTrash size={13} />
      </ConfirmButton>
    </li>
  );
}

export function FileDropzone({
  onFiles,
  busy,
  accept = "application/pdf,image/jpeg,image/png,image/webp",
  multiple = true,
  title = "Déposez vos scans ici",
  hint = "PDF, JPEG, PNG ou WEBP · 20 Mo maximum",
  compact = false,
  progress = null,
}: {
  onFiles: (files: FileList) => void;
  busy?: boolean;
  /** Avancement de l'envoi en cours (0 à 1). */
  progress?: number | null;
  accept?: string;
  multiple?: boolean;
  title?: string;
  hint?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`relative flex items-center gap-3 rounded-2xl border-2 border-dashed transition-colors ${
        over ? "border-act bg-act-soft" : "border-line bg-surface-2/50 hover:border-act/50"
      } ${compact ? "px-4 py-3" : "flex-col px-6 py-8 text-center"}`}
    >
      <span className={`grid shrink-0 place-items-center rounded-full bg-act-soft text-act ${compact ? "h-9 w-9" : "h-12 w-12"}`}>
        <IconUpload size={compact ? 17 : 21} />
      </span>
      <div className={compact ? "min-w-0 flex-1" : ""}>
        <p className="text-[14px] font-semibold">{busy ? `Envoi en cours${progress != null ? ` · ${Math.round(progress * 100)} %` : "…"}` : title}</p>
        {busy && progress != null && (
          <span className="mt-1.5 block h-1.5 w-full min-w-[140px] overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-act transition-[width] duration-200" style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </span>
        )}
        <p className="text-[12px] text-muted">
          {hint} — ou{" "}
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="font-semibold text-act underline-offset-2 hover:underline">
            parcourir
          </button>
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={busy}
        aria-label={title}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
        className="sr-only"
      />
    </div>
  );
}
