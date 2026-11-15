"use client";

import { useRef, useState } from "react";
import { photoFromWeb, removePhoto, uploadPhoto } from "@/lib/networkClient";
import { IconGlobe, IconTrash, IconUpload } from "@/components/icons";

export type Photo = { path: string; url: string | null } | null;

/** Pastille photo : ronde pour une personne, carrée arrondie pour un organisme (logo). */
export function PhotoBadge({ url, label, shape, size = 40, className = "" }: { url: string | null | undefined; label: string; shape: "circle" | "square"; size?: number; className?: string }) {
  const round = shape === "circle" ? "rounded-full" : "rounded-xl";
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden ${round} ${url ? "bg-white" : shape === "circle" ? "bg-surface-2 text-muted" : "bg-act-soft text-act"} font-display font-bold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire du stockage privé
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{label}</span>
      )}
    </span>
  );
}

interface Props {
  dossierId: string;
  kind: "org" | "person";
  id: string;
  url: string | null | undefined;
  path: string | null | undefined;
  label: string;
  /** Adresse proposée pour « Depuis internet » (site de l'organisme). */
  suggestedUrl?: string;
  onChange: (photo: Photo) => void;
}

/** Ajouter une photo : depuis l'appareil (photothèque ou appareil photo) ou depuis internet. */
export function PhotoPicker({ dossierId, kind, id, url, path, label, suggestedUrl = "", onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [web, setWeb] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(what: string, fn: () => Promise<void>) {
    setBusy(what);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'opération a échoué.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <PhotoBadge url={url} label={label} shape={kind === "org" ? "square" : "circle"} size={88} className="ring-1 ring-line" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void run("upload", async () => onChange(await uploadPhoto(dossierId, kind, id, f, path ?? null)));
            }}
          />
          <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="btn btn-sm btn-ghost">
            <IconUpload size={14} /> {busy === "upload" ? "Envoi…" : url ? "Changer la photo" : "Importer une photo"}
          </button>
          <button type="button" onClick={() => setWeb(web === null ? suggestedUrl : null)} disabled={!!busy} className="btn btn-sm btn-ghost">
            <IconGlobe size={14} /> Depuis internet
          </button>
          {url && (
            <button type="button" onClick={() => void run("remove", async () => (await removePhoto(kind, id, path ?? null), onChange(null)))} disabled={!!busy} className="btn btn-sm btn-ghost text-bad">
              <IconTrash size={14} /> Retirer
            </button>
          )}
        </div>
        {web !== null && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!web.trim()) return;
              void run("web", async () => {
                onChange(await photoFromWeb(kind, id, web));
                setWeb(null);
              });
            }}
          >
            <input
              autoFocus
              value={web}
              onChange={(e) => setWeb(e.target.value)}
              inputMode="url"
              placeholder={kind === "org" ? "Site de l'organisme ou adresse d'une image" : "Adresse d'une image (profil public…)"}
              aria-label="Adresse sur internet"
              className="input min-w-0 flex-1 py-1.5 text-[13px]"
            />
            <button type="submit" disabled={!!busy || !web.trim()} className="btn btn-sm btn-primary">
              {busy === "web" ? "Recherche…" : "Récupérer"}
            </button>
          </form>
        )}
        <p className="mt-1.5 text-[11.5px] text-faint">
          {kind === "org"
            ? "Avec l'adresse du site, le logo est cherché automatiquement. Sur iPad, « Importer » propose aussi l'appareil photo."
            : "Sur iPad, « Importer » propose la photothèque ou l'appareil photo."}
        </p>
        {error && <p className="mt-1 text-[12px] text-bad">{error}</p>}
      </div>
    </div>
  );
}
