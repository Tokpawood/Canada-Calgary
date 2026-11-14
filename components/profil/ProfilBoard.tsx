"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { audit, fswCalc, historyGaps, addressGaps, parseD, FSW_PASS_THRESHOLD, type AuditInput } from "@/lib/rules";
import type { AddressEntry, Dossier, FswProfile, HistoryEntry, Identity, Profile } from "@/lib/types";
import { FswGrid } from "./FswGrid";
import { AddressesTable, HistoryTable } from "./HistoryAddressTables";
import { FieldGrid, type FieldDef } from "./FieldGrid";
import { AuditPanel } from "@/components/AuditPanel";
import { Chip, Meter, PageHeader, TONE_CLASS, type Tone } from "@/components/ui";
import { newId } from "@/lib/ids";
import { syncRows } from "@/lib/syncRows";
import { EditBar, changedFields, useEditable } from "@/components/editable";
import { IconDownload, IconGlobe, IconPrinter, IconRoute, IconUser } from "@/components/icons";

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

type IdKey = Exclude<keyof Identity, "dossierId">;
type ProfileKey = Exclude<keyof Profile, "dossierId">;

const ID_FIELDS: Array<FieldDef<IdKey>> = [
  { key: "nom", label: "Nom" },
  { key: "prenoms", label: "Prénoms (dans l'ordre)" },
  { key: "naissance", label: "Date de naissance", type: "date" },
  { key: "lieu", label: "Lieu de naissance" },
  { key: "pere", label: "Père" },
  { key: "mere", label: "Mère" },
  { key: "statut", label: "État civil" },
];

const PROFILE_GROUPS: Array<{ title: string; fields: Array<FieldDef<ProfileKey>> }> = [
  {
    title: "Projet",
    fields: [
      { key: "programme", label: "Programme" },
      { key: "titre", label: "Titre professionnel" },
      { key: "cnp", label: "Code CNP" },
      { key: "ville", label: "Ville visée" },
      { key: "repli", label: "Ville de repli" },
    ],
  },
  {
    title: "Situation",
    fields: [
      { key: "nationalite", label: "Nationalité" },
      { key: "enfants", label: "Enfants" },
      { key: "passeport", label: "Passeport", placeholder: "Numéro, une fois délivré" },
      { key: "permis", label: "Permis de conduire" },
    ],
  },
  {
    title: "Coordonnées",
    fields: [
      { key: "telephone", label: "Téléphone", type: "tel" },
      { key: "courriel", label: "Courriel", type: "email" },
      { key: "adresse", label: "Adresse actuelle", wide: true },
    ],
  },
];

const PROFILE_KEYS = PROFILE_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

const SECTIONS = [
  { id: "identite", label: "Identité" },
  { id: "profil-ee", label: "Profil" },
  { id: "grille", label: "Grille de points" },
  { id: "historique", label: "Historique" },
  { id: "adresses", label: "Adresses" },
] as const;
const SECTION_IDS = SECTIONS.map((s) => s.id);

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

  const fswResult = useMemo(() => fswCalc(fsw, identity.naissance, dossier.profileDate, history), [fsw, identity.naissance, dossier.profileDate, history]);

  const auditItems = useMemo(
    () => audit({ ...auditSnapshot, identity, profile, history, addresses, fsw: fswResult }),
    [auditSnapshot, identity, profile, history, addresses, fswResult],
  );

  // Complétude de la fiche, calculée sur les valeurs enregistrées.
  const idMissing = ID_FIELDS.filter((f) => !String(identity[f.key] ?? "").trim()).length;
  const profileMissing = PROFILE_KEYS.filter((k) => !String(profile[k] ?? "").trim()).length;
  const totalFields = ID_FIELDS.length + PROFILE_KEYS.length;
  const completeness = Math.round(((totalFields - idMissing - profileMissing) / totalFields) * 100);

  const fswTone: Tone = fswResult.status === "Admissible" ? "ok" : fswResult.status === "À compléter" ? "todo" : "bad";
  const sectionBadge: Record<(typeof SECTIONS)[number]["id"], { text: string; tone: Tone } | null> = {
    identite: idMissing ? { text: String(idMissing), tone: "opt" } : null,
    "profil-ee": profileMissing ? { text: String(profileMissing), tone: "opt" } : null,
    grille: { text: String(fswResult.total), tone: fswTone },
    historique: histGaps.length ? { text: String(histGaps.length), tone: "bad" } : null,
    adresses: addrGaps.length ? { text: String(addrGaps.length), tone: "bad" } : null,
  };

  const active = useActiveSection(SECTION_IDS);
  const idv = idEd.current;
  const pv = profileEd.current;

  return (
    <>
      <PageHeader
        title="Profil"
        description="Votre fiche de référence pour Entrée express : identité, profil, grille de points et historique depuis vos 18 ans."
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

      <ProfileHero
        identity={identity}
        profile={profile}
        completeness={completeness}
        missing={idMissing + profileMissing}
        fswTotal={fswResult.total}
        fswStatus={fswResult.status}
        fswTone={fswTone}
      />

      <nav aria-label="Sections du profil" className="no-print no-scrollbar z-20 -mx-1 mt-5 mb-5 flex gap-1.5 overflow-x-auto px-1 py-1 lg:sticky lg:top-3">
        <div className="card flex gap-1 p-1">
          {SECTIONS.map((s) => {
            const badge = sectionBadge[s.id];
            const on = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={on ? "true" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  on ? "bg-act text-act-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {s.label}
                {badge && (
                  <span className={`mono rounded-full px-1.5 text-[10.5px] ${on ? "bg-white/20 text-act-ink" : TONE_CLASS[badge.tone]}`}>{badge.text}</span>
                )}
              </a>
            );
          })}
        </div>
      </nav>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div id="fiche-profil" className="flex flex-col gap-5">
            <Section
              id="identite"
              icon={<IconUser size={17} />}
              title="Identité de référence"
              sub="À reproduire à l'identique sur chaque document et formulaire."
              editing={idEd.editing}
              actions={<EditBar edit={idEd} className="no-print" />}
            >
              <FieldGrid
                fields={ID_FIELDS}
                values={{ ...idv, naissance: idv.naissance ?? "" } as Record<IdKey, string>}
                editing={idEd.editing}
                onChange={(k, v) => idEd.set({ [k]: k === "naissance" ? v || null : v } as Partial<Identity>)}
              />
            </Section>

            <Section
              id="profil-ee"
              icon={<IconGlobe size={17} />}
              title="Profil Entrée express"
              sub="Les informations déclarées dans le profil en ligne."
              editing={profileEd.editing}
              actions={<EditBar edit={profileEd} className="no-print" />}
            >
              <div className="flex flex-col gap-5">
                {PROFILE_GROUPS.map((g, i) => (
                  <div key={g.title} className={i ? "border-t border-line pt-4" : ""}>
                    <p className="eyebrow mb-3">{g.title}</p>
                    <FieldGrid
                      fields={g.fields}
                      values={pv as unknown as Record<ProfileKey, string>}
                      editing={profileEd.editing}
                      onChange={(k, v) => profileEd.set({ [k]: v } as Partial<Profile>)}
                    />
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div id="grille" className="scroll-mt-20">
            <FswGrid
              fsw={fswEd.current}
              naissance={identity.naissance}
              profileDate={dossier.profileDate}
              history={history}
              editing={fswEd.editing}
              onChange={fswEd.set}
              actions={<EditBar edit={fswEd} />}
            />
          </div>

          <div id="historique" className="scroll-mt-20">
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
          </div>

          <div id="adresses" className="scroll-mt-20">
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
        </div>

        <div className="no-print xl:sticky xl:top-20 xl:self-start">
          <AuditPanel items={auditItems} limit={8} />
        </div>
      </div>
    </>
  );
}

/** Section qui met en avant la carte active pour le menu de navigation. */
function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState<string>(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => e !== null);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -55% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function Section({
  id,
  icon,
  title,
  sub,
  editing,
  actions,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  sub: string;
  editing: boolean;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`card scroll-mt-20 p-4 transition-shadow sm:p-5 ${editing ? "ring-2 ring-act-soft" : ""}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-act-soft text-act">{icon}</span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold">{title}</h2>
            <p className="text-[12.5px] text-muted">{sub}</p>
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function ageFrom(naissance: string | null): number | null {
  const d = parseD(naissance);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function ProfileHero({
  identity,
  profile,
  completeness,
  missing,
  fswTotal,
  fswStatus,
  fswTone,
}: {
  identity: Identity;
  profile: Profile;
  completeness: number;
  missing: number;
  fswTotal: number;
  fswStatus: string;
  fswTone: Tone;
}) {
  const fullName = [identity.prenoms, identity.nom].filter(Boolean).join(" ");
  const initials = ((identity.prenoms.trim()[0] ?? "") + (identity.nom.trim()[0] ?? "")).toUpperCase() || "?";
  const age = ageFrom(identity.naissance);
  const born = parseD(identity.naissance);
  const facts = [
    born ? `Naissance : ${born.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${age != null ? ` · ${age} ans` : ""}` : null,
    profile.nationalite || null,
    identity.statut || null,
  ].filter(Boolean);

  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl bg-night font-display text-[26px] font-bold text-night-ink">{initials}</span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[24px] leading-tight font-bold">{fullName || "Identité à compléter"}</h2>
            {facts.length > 0 && <p className="mt-1 text-[13px] text-muted">{facts.join(" · ")}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.titre && <Chip tone="todo">{profile.titre}</Chip>}
              {profile.cnp && <Chip tone="todo">CNP {profile.cnp}</Chip>}
              {profile.ville && (
                <Chip tone="act">
                  <IconRoute size={12} /> {profile.ville}
                  {profile.repli ? ` · repli ${profile.repli}` : ""}
                </Chip>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-line bg-line lg:grid-cols-1 lg:border-t-0 lg:border-l">
          <div className="bg-surface px-5 py-4">
            <p className="eyebrow">Grille de points</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="mono text-[24px] leading-none font-semibold">{fswTotal}</span>
              <span className="text-[12px] text-muted">/ 100 · seuil {FSW_PASS_THRESHOLD}</span>
            </div>
            <Chip tone={fswTone} dot className="mt-2">
              {fswStatus}
            </Chip>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="eyebrow">Fiche complétée</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="mono text-[24px] leading-none font-semibold">{completeness} %</span>
              <span className="text-[12px] text-muted">{missing ? `${missing} champ(s) vide(s)` : "complète"}</span>
            </div>
            <Meter value={completeness} tone={completeness === 100 ? "ok" : "act"} height={4} className="mt-3" label="Complétude de la fiche" />
          </div>
        </div>
      </div>
    </section>
  );
}
