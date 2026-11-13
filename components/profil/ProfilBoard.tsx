"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { audit, fswCalc, historyGaps, addressGaps, type AuditInput } from "@/lib/rules";
import type { AddressEntry, Dossier, FswProfile, HistoryEntry, Identity, Profile } from "@/lib/types";
import { FswGrid } from "./FswGrid";
import { AddressesTable, HistoryTable } from "./HistoryAddressTables";
import { AuditPanel } from "@/components/AuditPanel";
import { PageHeader } from "@/components/ui";
import { newId } from "@/lib/ids";
import { IconDownload, IconPrinter } from "@/components/icons";

export interface AuditSnapshot {
  steps: AuditInput["steps"];
  documents: AuditInput["documents"];
  gaps: AuditInput["gaps"];
  savings: AuditInput["savings"];
}

interface Props {
  dossier: Dossier;
  initialIdentity: Identity;
  initialProfile: Profile;
  initialFsw: FswProfile;
  initialHistory: HistoryEntry[];
  initialAddresses: AddressEntry[];
  auditSnapshot: AuditSnapshot;
}

export function ProfilBoard({ dossier, initialIdentity, initialProfile, initialFsw, initialHistory, initialAddresses, auditSnapshot }: Props) {
  const [identity, setIdentity] = useState(initialIdentity);
  const [profile, setProfile] = useState(initialProfile);
  const [fsw, setFsw] = useState(initialFsw);
  const [history, setHistory] = useState(initialHistory);
  const [addresses, setAddresses] = useState(initialAddresses);
  const supabase = createClient();

  async function updateIdentity(patch: Partial<Identity>) {
    setIdentity((prev) => ({ ...prev, ...patch }));
    await supabase.from("identity").update(patch).eq("dossier_id", dossier.id);
  }

  async function updateProfile(patch: Partial<Profile>) {
    setProfile((prev) => ({ ...prev, ...patch }));
    await supabase.from("profile").update(patch).eq("dossier_id", dossier.id);
  }

  async function updateFsw(patch: Partial<FswProfile>) {
    setFsw((prev) => ({ ...prev, ...patch }));
    await supabase.from("fsw").update(patch).eq("dossier_id", dossier.id);
  }

  async function addHistory() {
    const id = newId("h");
    const row: HistoryEntry = { id, dossierId: dossier.id, from: "", to: "", type: "Autre", activity: "", org: "", place: "", parallel: false };
    setHistory((prev) => [...prev, row]);
    await supabase.from("history").insert({ id, dossier_id: dossier.id, from_date: "", type: "Autre", position: history.length });
  }

  async function updateHistory(id: string, patch: Partial<HistoryEntry>) {
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    const dbPatch: Record<string, unknown> = { ...patch };
    if ("from" in patch) dbPatch.from_date = patch.from;
    if ("to" in patch) dbPatch.to_date = patch.to;
    delete dbPatch.from;
    delete dbPatch.to;
    await supabase.from("history").update(dbPatch).eq("id", id);
  }

  async function deleteHistory(id: string) {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    await supabase.from("history").delete().eq("id", id);
  }

  async function addAddress() {
    const id = newId("a");
    const row: AddressEntry = { id, dossierId: dossier.id, from: "", to: "", address: "", city: "", note: "", parallel: false };
    setAddresses((prev) => [...prev, row]);
    await supabase.from("address").insert({ id, dossier_id: dossier.id, from_date: "", position: addresses.length });
  }

  async function updateAddress(id: string, patch: Partial<AddressEntry>) {
    setAddresses((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const dbPatch: Record<string, unknown> = { ...patch };
    if ("from" in patch) dbPatch.from_date = patch.from;
    if ("to" in patch) dbPatch.to_date = patch.to;
    delete dbPatch.from;
    delete dbPatch.to;
    await supabase.from("address").update(dbPatch).eq("id", id);
  }

  async function deleteAddress(id: string) {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("address").delete().eq("id", id);
  }

  const histGaps = useMemo(() => historyGaps(history, identity.naissance), [history, identity.naissance]);
  const addrGaps = useMemo(() => addressGaps(addresses, identity.naissance), [addresses, identity.naissance]);

  const fswResult = useMemo(
    () => fswCalc(fsw, identity.naissance, dossier.profileDate, history),
    [fsw, identity.naissance, dossier.profileDate, history],
  );

  const auditItems = useMemo(
    () =>
      audit({
        ...auditSnapshot,
        identity,
        profile,
        history,
        addresses,
        fsw: fswResult,
      }),
    [auditSnapshot, identity, profile, history, addresses, fswResult],
  );

  const fullName = [identity.prenoms, identity.nom].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader
        title="Profil"
        description="Identité de référence, profil Entrée express, grille de points et historique depuis vos 18 ans."
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <a href="/api/export/json" className="btn btn-sm btn-ghost">
              <IconDownload size={14} /> JSON
            </a>
            <a href="/api/export/excel" className="btn btn-sm btn-ghost">
              <IconDownload size={14} /> Excel
            </a>
            <button type="button" onClick={() => window.print()} className="btn btn-sm btn-primary">
              <IconPrinter size={14} /> Imprimer la fiche
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div id="fiche-profil" className="flex flex-col gap-5">
            <section className="card p-4 sm:p-5">
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-night font-display text-lg font-bold text-night-ink">
                  {initials(identity.prenoms, identity.nom)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-[19px] font-bold">{fullName || "Identité à compléter"}</p>
                  <p className="text-[12.5px] text-muted">Identité de référence — à reproduire à l&apos;identique sur chaque document</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Nom" value={identity.nom} onChange={(v) => updateIdentity({ nom: v })} />
                <TextField label="Prénoms (dans l'ordre)" value={identity.prenoms} onChange={(v) => updateIdentity({ prenoms: v })} />
                <TextField label="Date de naissance" type="date" value={identity.naissance ?? ""} onChange={(v) => updateIdentity({ naissance: v || null })} />
                <TextField label="Lieu de naissance" value={identity.lieu} onChange={(v) => updateIdentity({ lieu: v })} />
                <TextField label="Père" value={identity.pere} onChange={(v) => updateIdentity({ pere: v })} />
                <TextField label="Mère" value={identity.mere} onChange={(v) => updateIdentity({ mere: v })} />
                <TextField label="État civil" value={identity.statut} onChange={(v) => updateIdentity({ statut: v })} />
              </div>
            </section>

            <section className="card p-4 sm:p-5">
              <h2 className="text-[17px] font-bold">Profil Entrée express</h2>
              <ProfileGroup title="Projet">
                <TextField label="Programme" value={profile.programme} onChange={(v) => updateProfile({ programme: v })} />
                <TextField label="Titre professionnel" value={profile.titre} onChange={(v) => updateProfile({ titre: v })} />
                <TextField label="Code CNP" value={profile.cnp} onChange={(v) => updateProfile({ cnp: v })} />
                <TextField label="Ville visée" value={profile.ville} onChange={(v) => updateProfile({ ville: v })} />
                <TextField label="Ville de repli" value={profile.repli} onChange={(v) => updateProfile({ repli: v })} />
              </ProfileGroup>
              <ProfileGroup title="Situation">
                <TextField label="Nationalité" value={profile.nationalite} onChange={(v) => updateProfile({ nationalite: v })} />
                <TextField label="Enfants" value={profile.enfants} onChange={(v) => updateProfile({ enfants: v })} />
                <TextField label="Passeport" value={profile.passeport} onChange={(v) => updateProfile({ passeport: v })} placeholder="Numéro, une fois délivré" />
                <TextField label="Permis de conduire" value={profile.permis} onChange={(v) => updateProfile({ permis: v })} />
              </ProfileGroup>
              <ProfileGroup title="Coordonnées">
                <TextField label="Téléphone" type="tel" value={profile.telephone} onChange={(v) => updateProfile({ telephone: v })} />
                <TextField label="Courriel" type="email" value={profile.courriel} onChange={(v) => updateProfile({ courriel: v })} />
                <TextField label="Adresse actuelle" value={profile.adresse} onChange={(v) => updateProfile({ adresse: v })} className="sm:col-span-2" />
              </ProfileGroup>
            </section>
          </div>

          <FswGrid fsw={fsw} naissance={identity.naissance} profileDate={dossier.profileDate} history={history} onChange={updateFsw} />

          <HistoryTable rows={history} gaps={histGaps} naissance={identity.naissance} onAdd={addHistory} onUpdate={updateHistory} onDelete={deleteHistory} />
          <AddressesTable rows={addresses} gaps={addrGaps} naissance={identity.naissance} onAdd={addAddress} onUpdate={updateAddress} onDelete={deleteAddress} />
        </div>

        <div className="no-print xl:sticky xl:top-6 xl:self-start">
          <AuditPanel items={auditItems} limit={8} />
        </div>
      </div>
    </>
  );
}

function initials(prenoms: string, nom: string): string {
  const a = prenoms.trim()[0] ?? "";
  const b = nom.trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

function ProfileGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-line pt-4 first-of-type:mt-3">
      <p className="eyebrow mb-2.5">{title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="field-label">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="input" />
    </label>
  );
}
