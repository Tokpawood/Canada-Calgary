"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { audit, fswCalc, historyGaps, addressGaps, type AuditInput } from "@/lib/rules";
import type { AddressEntry, Dossier, FswProfile, HistoryEntry, Identity, Profile } from "@/lib/types";
import { FswGrid } from "./FswGrid";
import { AddressesTable, HistoryTable } from "./HistoryAddressTables";
import { AuditPanel } from "@/components/AuditPanel";

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
    const id = `h-${Date.now().toString(36)}`;
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
    const id = `a-${Date.now().toString(36)}`;
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div>
        <div id="fiche-profil">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Identité de référence</h3>
              <button type="button" onClick={() => window.print()} className="no-print rounded-md bg-act-soft px-2.5 py-1 text-xs font-semibold text-act">
                Imprimer / PDF
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <TextField label="Nom" value={identity.nom} onChange={(v) => updateIdentity({ nom: v })} />
              <TextField label="Prénoms" value={identity.prenoms} onChange={(v) => updateIdentity({ prenoms: v })} />
              <TextField label="Naissance" type="date" value={identity.naissance ?? ""} onChange={(v) => updateIdentity({ naissance: v || null })} />
              <TextField label="Lieu de naissance" value={identity.lieu} onChange={(v) => updateIdentity({ lieu: v })} />
              <TextField label="Père" value={identity.pere} onChange={(v) => updateIdentity({ pere: v })} />
              <TextField label="Mère" value={identity.mere} onChange={(v) => updateIdentity({ mere: v })} />
              <TextField label="Statut" value={identity.statut} onChange={(v) => updateIdentity({ statut: v })} />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
            <h3 className="text-base font-bold">Profil Entrée express</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <TextField label="Titre professionnel" value={profile.titre} onChange={(v) => updateProfile({ titre: v })} />
              <TextField label="CNP" value={profile.cnp} onChange={(v) => updateProfile({ cnp: v })} />
              <TextField label="Nationalité" value={profile.nationalite} onChange={(v) => updateProfile({ nationalite: v })} />
              <TextField label="Enfants" value={profile.enfants} onChange={(v) => updateProfile({ enfants: v })} />
              <TextField label="Passeport" value={profile.passeport} onChange={(v) => updateProfile({ passeport: v })} />
              <TextField label="Permis de conduire" value={profile.permis} onChange={(v) => updateProfile({ permis: v })} />
              <TextField label="Téléphone" value={profile.telephone} onChange={(v) => updateProfile({ telephone: v })} />
              <TextField label="Courriel" value={profile.courriel} onChange={(v) => updateProfile({ courriel: v })} />
              <TextField label="Adresse actuelle" value={profile.adresse} onChange={(v) => updateProfile({ adresse: v })} />
              <TextField label="Programme" value={profile.programme} onChange={(v) => updateProfile({ programme: v })} />
              <TextField label="Ville visée" value={profile.ville} onChange={(v) => updateProfile({ ville: v })} />
              <TextField label="Ville de repli" value={profile.repli} onChange={(v) => updateProfile({ repli: v })} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <FswGrid fsw={fsw} naissance={identity.naissance} profileDate={dossier.profileDate} history={history} onChange={updateFsw} />
        </div>

        <div className="mt-4">
          <HistoryTable rows={history} gaps={histGaps} onAdd={addHistory} onUpdate={updateHistory} onDelete={deleteHistory} />
          <AddressesTable rows={addresses} gaps={addrGaps} onAdd={addAddress} onUpdate={updateAddress} onDelete={deleteAddress} />
        </div>
      </div>

      <div className="no-print lg:sticky lg:top-4 lg:self-start">
        <AuditPanel items={auditItems} limit={8} />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="text-xs font-medium text-muted">
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm text-ink" />
    </label>
  );
}
