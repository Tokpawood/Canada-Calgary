"use client";

import { useState } from "react";
import type { VaultFile } from "@/lib/types";
import { formatSize } from "@/components/FileDropzone";
import { IconFile, IconFolder, IconImage } from "@/components/icons";
import { fileKind, isPdf } from "./FilePreview";

export function FileCard({ file, thumb, doc, folder, onOpen }: { file: VaultFile; thumb?: string; doc: string; folder?: string | null; onOpen: () => void }) {
  const pdf = isPdf(file);
  // Vignette illisible : on retombe sur l'icône plutôt qu'une image cassée.
  const [thumbFailed, setThumbFailed] = useState(false);
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
          ) : thumb && !thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- vignette servie par lien signé temporaire
            <img src={thumb} alt="" loading="lazy" decoding="async" onError={() => setThumbFailed(true)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
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
          {folder && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
              <IconFolder size={12} className="shrink-0" />
              <span className="truncate">{folder}</span>
            </span>
          )}
          <span className="mono mt-0.5 block text-[11px] text-faint">
            {formatSize(file.size)}
            {file.replacedAt
              ? ` · remplacé le ${new Date(file.replacedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
              : file.uploadedAt && ` · ${new Date(file.uploadedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
          </span>
          {!file.replacedAt && (
            <span className={`mt-0.5 block text-[11px] ${file.onDrive ? "text-ok" : "text-faint"}`}>{file.onDrive ? "✓ Sauvegardé sur Drive" : "Sauvegarde Drive en cours"}</span>
          )}
        </span>
      </button>
    </li>
  );
}
