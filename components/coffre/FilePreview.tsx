"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { VaultFile } from "@/lib/types";
import { ConfirmButton } from "@/components/ui";
import { formatSize } from "@/components/FileDropzone";
import { IconChevronLeft, IconChevronRight, IconCopy, IconDownload, IconExternal, IconFile, IconFolder, IconTrash, IconX } from "@/components/icons";

export const isPdf = (f: VaultFile) => f.mime === "application/pdf";

export function fileKind(f: VaultFile): string {
  return isPdf(f) ? "PDF" : f.mime.replace("image/", "").toUpperCase();
}

export function fileDate(f: VaultFile): string {
  return f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
}

/** Vrai si `el` est la dernière fenêtre modale ouverte (même règle que le Drawer de components/ui.tsx). */
function isTopModal(el: HTMLElement | null): boolean {
  if (!el) return false;
  const modals = document.querySelectorAll('[aria-modal="true"]');
  return modals[modals.length - 1] === el;
}

interface Props {
  files: VaultFile[];
  index: number;
  documentLabel: (f: VaultFile) => string;
  /** Lien signé (5 min) pour afficher le fichier ; `download` force le téléchargement sous son nom. */
  signUrl: (f: VaultFile, download?: boolean) => Promise<string | null>;
  onIndex: (i: number) => void;
  onDelete: (f: VaultFile) => void;
  onClose: () => void;
  /** Classement dans un dossier du Coffre (absent ailleurs). */
  folders?: Array<{ id: string; name: string }>;
  onMove?: (f: VaultFile, folderId: string | null) => void;
  /** Copie dans un dossier (l'original reste à sa place). */
  onCopy?: (f: VaultFile, folderId: string | null) => void;
}

/** Visionneuse plein écran : image ou PDF, navigation au clavier (← → Échap). */
export function FilePreview({ files, index, documentLabel, signUrl, onIndex, onDelete, onClose, folders, onMove, onCopy }: Props) {
  const file = files[index];
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);
  const url = loaded?.id === file?.id ? loaded.url : undefined;
  // Image illisible (fichier absent de Drive, session expirée…) : on l'affiche au lieu d'une image cassée.
  const [broken, setBroken] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus sur « Fermer » à l'ouverture, gardé dans la visionneuse avec Tab, rendu à l'élément d'origine à la fermeture.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onTab = (e: KeyboardEvent) => {
      const box = dialogRef.current;
      if (e.key !== "Tab" || !box || !isTopModal(box)) return;
      const items = Array.from(
        box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = box.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => {
      document.removeEventListener("keydown", onTab);
      // L'élément d'origine a pu disparaître (fichier supprimé depuis l'aperçu) : on ne vise que s'il est encore là.
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    void signUrl(file).then((u) => {
      if (alive) setLoaded({ id: file.id, url: u });
    });
    return () => {
      alive = false;
    };
  }, [file, signUrl]);

  useEffect(() => {
    const self = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      // Une autre fenêtre ouverte par-dessus l'aperçu garde la main sur le clavier.
      if (self && !isTopModal(self)) return;
      if (e.key === "Escape") {
        // Échap ne ferme que l'aperçu : le tiroir dessous (Drawer) ignore un événement déjà traité.
        e.preventDefault();
        onClose();
        return;
      }
      // Flèches dans une liste (Déplacer, Copier) : elles changent la valeur, pas le fichier affiché.
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("locked");
    return () => {
      document.removeEventListener("keydown", onKey);
      // Un tiroir resté ouvert sous l'aperçu doit garder la page verrouillée.
      const others = Array.from(document.querySelectorAll('[aria-modal="true"]')).filter((el) => el !== self);
      if (!others.length) document.body.classList.remove("locked");
    };
  }, [index, files.length, onIndex, onClose]);

  if (!file) return null;

  async function download() {
    const u = await signUrl(file, true);
    if (!u) return;
    const a = document.createElement("a");
    a.href = u;
    a.rel = "noopener";
    a.click();
  }

  async function openTab() {
    const u = await signUrl(file);
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  }

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Aperçu : ${file.name}`} className="anim-fade fixed inset-0 z-50 flex flex-col bg-black/90 text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{file.name}</p>
          <p className="mono truncate text-[11.5px] text-white/60">
            {fileKind(file)} · {formatSize(file.size)}
            {fileDate(file) && ` · ${fileDate(file)}`} · {documentLabel(file)}
          </p>
        </div>
        <span className="mono hidden text-[12px] text-white/60 sm:inline">
          {index + 1} / {files.length}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {folders && onMove && !file.replacedAt && (
            <label className="flex items-center gap-1.5 rounded-lg bg-white/10 pl-2.5 text-[12.5px] font-semibold">
              <IconFolder size={14} />
              <span className="sr-only">Déplacer dans un dossier{file.documentId ? " (reste lié à sa pièce)" : ""}</span>
              <select
                value={file.folderId ?? ""}
                onChange={(e) => onMove(file, e.target.value || null)}
                className="h-8 max-w-[180px] cursor-pointer truncate rounded-lg bg-transparent pr-2 text-white outline-none [&>option]:text-black"
              >
                <option value="">Non classé</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {folders && onCopy && !file.replacedAt && folders.length > 0 && (
            <label className="flex items-center gap-1.5 rounded-lg bg-white/10 pl-2.5 text-[12.5px] font-semibold" title="Mettre une copie dans un dossier">
              <IconCopy size={14} />
              <span className="sr-only">Copier dans un dossier</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onCopy(file, e.target.value);
                }}
                className="h-8 max-w-[150px] cursor-pointer truncate rounded-lg bg-transparent pr-2 text-white outline-none [&>option]:text-black"
              >
                <option value="">Copier dans…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={() => void download()} className="btn btn-sm bg-white/10 text-white hover:bg-white/20" title="Télécharger">
            <IconDownload size={15} />
            <span className="hidden md:inline">Télécharger</span>
          </button>
          <button type="button" onClick={() => void openTab()} className="btn btn-sm bg-white/10 text-white hover:bg-white/20" title="Ouvrir dans un nouvel onglet">
            <IconExternal size={15} />
            <span className="hidden md:inline">Nouvel onglet</span>
          </button>
          <ConfirmButton label={`Supprimer ${file.name}`} confirmLabel="Confirmer" onConfirm={() => onDelete(file)} className="btn btn-sm btn-danger">
            <IconTrash size={15} />
          </ConfirmButton>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fermer l'aperçu" className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
            <IconX size={18} />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6" onClick={onClose}>
        <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {url === undefined ? (
            <p className="text-sm text-white/60">Chargement de l&apos;aperçu…</p>
          ) : url === null || broken === file.id ? (
            <div className="max-w-sm text-center text-sm text-white/70" role="alert">
              <p>Aperçu indisponible : le fichier n&apos;a pas pu être lu.</p>
              <p className="mt-1 text-[12.5px] text-white/50">Essayez « Nouvel onglet » ou « Télécharger » ; si le problème persiste, rechargez la page.</p>
            </div>
          ) : isPdf(file) ? (
            <iframe key={file.id} src={`${url}#view=FitH`} title={file.name} className="h-full w-full max-w-5xl rounded-lg bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- fichier servi par l'application après contrôle d'accès, hors optimiseur d'images
            <img key={file.id} src={url} alt={file.name} onError={() => setBroken(file.id)} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          )}
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index - 1);
            }}
            aria-label="Fichier précédent"
            className="absolute top-1/2 left-2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/15 hover:bg-black/70 sm:left-4"
          >
            <IconChevronLeft size={22} />
          </button>
        )}
        {index < files.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index + 1);
            }}
            aria-label="Fichier suivant"
            className="absolute top-1/2 right-2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/15 hover:bg-black/70 sm:right-4"
          >
            <IconChevronRight size={22} />
          </button>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-3 text-[11.5px] text-white/50" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
        <IconFile size={12} /> Google Drive · ← → pour naviguer · Échap pour fermer
      </p>
    </div>,
    document.body,
  );
}
