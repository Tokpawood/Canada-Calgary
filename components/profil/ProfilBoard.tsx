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
import { syncRows } from "@/lib/syncRows";
import { EditBar, changedFields, useEditable } from "@/components/editable";
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

  async function updateSingle<T extends object>(table: string, before: T, after: T) {
    const patch: Record<string, unknown> = changedFields(before, after);
    if (Object.keys(patch).length === 0) return;
    const { error } = await supabase.from(table).update(patch).eq("dossier_id", dossier.id);
    if (error) throw error;
  }

  const idEd = useEditable(identity, async (d) => {
    await updateSingle("identity", identity, d);
    setIdentity(d);
  });
  const profileEd = useEditable(profile, async (d) => {
    await updateSingle("profile", profile, d);
    setProfile(d);
  });
  const fswEd = useEditable(fsw, async (d) => {
    await updateSingle("fsw", fsw, d);
    setFsw(d);
  });

  const histEd = useEditable(history, async (d) => {
    await syncRows(
      supabase,
      "history",
      history,
      d,
      (h) => ({ from_date: h.from, to_date: h.to, type: h.type, activity: h.activity, org: h.org, place: h.place, parallel: h.parallel }),
      { dossier_id: dossier.id },
    );
    setHistory(d);
  });

  const addrEd = useEditable(addresses, async (d) => {
    await syncRows(
      supabase,
      "address",
      addresses,
      d,
      (a) => ({ from_date: a.from, to_date: a.to, address: a.address, city: a.city, note: a.note, parallel: a.parallel }),
      { dossier_id: dossier.id },
    );
    setAddresses(d);
  });

  const histRows = histEd.current;
  const addrRows = addrEd.current;
  const histGaps = useMemo(() => historyGaps(histRows, identity.naissance), [histRows, identity.naissance]);
  const addrGaps = useMemo(() => addressGaps(addrRows, identity.naissance), [addrRows, identity.naissance]);
  const idv = idEd.current;
  const pv = profileEd.current;

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

  const fullName = [idv.prenoms, idv.nom].filter(Boolean).join(" ");
  const idOff = !idEd.editing;
  const pOff = !profileEd.editing;
  const setId = idEd.set;
  const setP = profileEd.set;

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
            <section className={`card p-4 sm:p-5 ${idEd.editing ? "ring-2 ring-act-soft" : ""}`}>
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-night font-display text-lg font-bold text-night-ink">
                  {initials(idv.prenoms, idv.nom)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[19px] font-bold">{fullName || "Identité à compléter"}</p>
                  <p className="text-[12.5px] text-muted">Identité de référence — à reproduire à l&apos;identique sur chaque document</p>
                </div>
                <EditBar edit={idEd} className="no-print" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField disabled={idOff} label="Nom" value={idv.nom} onChange={(v) => setId({ nom: v })} />
                <TextField disabled={idOff} label="Prénoms (dans l'ordre)" value={idv.prenoms} onChange={(v) => setId({ prenoms: v })} />
                <TextField disabled={idOff} label="Date de naissance" type="date" value={idv.naissance ?? ""} onChange={(v) => setId({ naissance: v || null })} />
                <TextField disabled={idOff} label="Lieu de naissance" value={idv.lieu} onChange={(v) => setId({ lieu: v })} />
                <TextField disabled={idOff} label="Père" value={idv.pere} onChange={(v) => setId({ pere: v })} />
                <TextField disabled={idOff} label="Mère" value={idv.mere} onChange={(v) => setId({ mere: v })} />
                <TextField disabled={idOff} label="État civil" value={idv.statut} onChange={(v) => setId({ statut: v })} />
              </div>
            </section>

            <section className={`card p-4 sm:p-5 ${profileEd.editing ? "ring-2 ring-act-soft" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[17px] font-bold">Profil Entrée express</h2>
                <EditBar edit={profileEd} className="no-print" />
              </div>
              <ProfileGroup title="Projet">
                <TextField disabled={pOff} label="Programme" value={pv.programme} onChange={(v) => setP({ programme: v })} />
                <TextField disabled={pOff} label="Titre professionnel" value={pv.titre} onChange={(v) => setP({ titre: v })} />
                <TextField disabled={pOff} label="Code CNP" value={pv.cnp} onChange={(v) => setP({ cnp: v })} />
                <TextField disabled={pOff} label="Ville visée" value={pv.ville} onChange={(v) => setP({ ville: v })} />
                <TextField disabled={pOff} label="Ville de repli" value={pv.repli} onChange={(v) => setP({ repli: v })} />
              </ProfileGroup>
              <ProfileGroup title="Situation">
                <TextField disabled={pOff} label="Nationalité" value={pv.nationalite} onChange={(v) => setP({ nationalite: v })} />
                <TextField disabled={pOff} label="Enfants" value={pv.enfants} onChange={(v) => setP({ enfants: v })} />
                <TextField disabled={pOff} label="Passeport" value={pv.passeport} onChange={(v) => setP({ passeport: v })} placeholder="Numéro, une fois délivré" />
                <TextField disabled={pOff} label="Permis de conduire" value={pv.permis} onChange={(v) => setP({ permis: v })} />
              </ProfileGroup>
              <ProfileGroup title="Coordonnées">
                <TextField disabled={pOff} label="Téléphone" type="tel" value={pv.telephone} onChange={(v) => setP({ telephone: v })} />
                <TextField disabled={pOff} label="Courriel" type="email" value={pv.courriel} onChange={(v) => setP({ courriel: v })} />
                <TextField disabled={pOff} label="Adresse actuelle" value={pv.adresse} onChange={(v) => setP({ adresse: v })} className="sm:col-span-2" />
              </ProfileGroup>
            </section>
          </div>

          <FswGrid
            fsw={fswEd.current}
            naissance={identity.naissance}
            profileDate={dossier.profileDate}
            history={history}
            editing={fswEd.editing}
            onChange={fswEd.set}
            actions={<EditBar edit={fswEd} />}
          />

          <HistoryTable
            rows={histRows}
            gaps={histGaps}
            naissance={identity.naissance}
            editing={histEd.editing}
            actions={<EditBar edit={histEd} />}
            onAdd={() =>
              histEd.update((d) => [...d, { id: newId("h"), dossierId: dossier.id, from: "", to: "", type: "Autre", activity: "", org: "", place: "", parallel: false }])
            }
            onUpdate={(id, patch) => histEd.update((d) => d.map((h) => (h.id === id ? { ...h, ...patch } : h)))}
            onDelete={(id) => histEd.update((d) => d.filter((h) => h.id !== id))}
          />
          <AddressesTable
            rows={addrRows}
            gaps={addrGaps}
            naissance={identity.naissance}
            editing={addrEd.editing}
            actions={<EditBar edit={addrEd} />}
            onAdd={() => addrEd.update((d) => [...d, { id: newId("a"), dossierId: dossier.id, from: "", to: "", address: "", city: "", note: "", parallel: false }])}
            onUpdate={(id, patch) => addrEd.update((d) => d.map((a) => (a.id === id ? { ...a, ...patch } : a)))}
            onDelete={(id) => addrEd.update((d) => d.filter((a) => a.id !== id))}
          />
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={className}>
      <span className="field-label">{label}</span>
      <input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="input" />
    </label>
  );
}
