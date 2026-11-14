"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@/lib/account";
import { createClient } from "@/lib/supabase/client";
import { removeAvatar, uploadAvatar } from "@/lib/avatarUpload";
import { Avatar } from "@/components/Avatar";
import { IconCheck, IconTrash, IconUpload, IconUser } from "@/components/icons";

/** Titulaire du compte : photo de profil, prénom et nom (affichés dans la barre latérale). */
export function AccountIdentityCard({ account }: { account: Account }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [busy, setBusy] = useState<"photo" | "name" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = firstName.trim() !== account.firstName || lastName.trim() !== account.lastName;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return setMsg({ ok: false, text: "Indiquez le prénom et le nom." });
    setBusy("name");
    const { error } = await createClient().auth.updateUser({ data: { first_name: firstName.trim(), last_name: lastName.trim() } });
    setBusy(null);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Nom du titulaire enregistré." });
    if (!error) router.refresh();
  }

  async function onPhoto(file: File) {
    setBusy("photo");
    setMsg(null);
    const err = await uploadAvatar(file);
    setBusy(null);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "Photo de profil enregistrée." });
    if (!err) router.refresh();
  }

  async function onRemove() {
    setBusy("photo");
    const err = await removeAvatar(account.avatarPath);
    setBusy(null);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "Photo retirée." });
    if (!err) router.refresh();
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-act-soft text-act">
          <IconUser size={18} />
        </span>
        <div>
          <h2 className="text-[17px] font-bold">Titulaire du compte</h2>
          <p className="text-[13px] text-muted">Votre nom et votre photo, affichés dans la barre latérale. La connexion se fait avec votre courriel et votre mot de passe.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2.5 sm:w-[150px]">
          <button type="button" onClick={() => input.current?.click()} disabled={busy !== null} className="group/photo relative rounded-full" title="Changer la photo">
            <Avatar url={account.avatarUrl} initials={account.initials} size={104} className="ring-4 ring-surface-2" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover/photo:opacity-100">
              <IconUpload size={22} />
            </span>
            {busy === "photo" && <span className="absolute inset-0 animate-pulse rounded-full bg-black/40" />}
          </button>
          <div className="flex flex-wrap justify-center gap-1.5">
            <button type="button" onClick={() => input.current?.click()} disabled={busy !== null} className="btn btn-sm btn-soft">
              <IconUpload size={13} /> {account.avatarUrl ? "Changer" : "Ajouter une photo"}
            </button>
            {account.avatarUrl && (
              <button type="button" onClick={() => void onRemove()} disabled={busy !== null} className="btn btn-sm btn-danger" aria-label="Retirer la photo">
                <IconTrash size={13} />
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onPhoto(f);
            }}
          />
        </div>

        <form onSubmit={saveName} className="flex flex-1 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">Prénom</span>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </label>
            <label>
              <span className="field-label">Nom</span>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </label>
          </div>
          <label>
            <span className="field-label">Courriel de connexion</span>
            <input className="input" value={account.email} disabled />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!dirty || busy !== null} className="btn btn-primary">
              {busy === "name" ? "Enregistrement…" : "Enregistrer le nom"}
            </button>
            {msg && (
              <p role="status" className={`flex items-center gap-1.5 text-[12.5px] ${msg.ok ? "text-ok" : "text-bad"}`}>
                {msg.ok && <IconCheck size={14} strokeWidth={2.6} />}
                {msg.text}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
