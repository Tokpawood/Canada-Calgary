"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  audit,
  fswCalc,
  historyGaps,
  addressGaps,
  parseD,
  FSW_PASS_THRESHOLD,
  type AuditInput,
} from "@/lib/rules";
import type {
  AddressEntry,
  Dossier,
  FswProfile,
  HistoryEntry,
  Identity,
  Profile,
} from "@/lib/types";
import { FswGrid } from "./FswGrid";
import { AddressesTable, HistoryTable } from "./HistoryAddressTables";
import { FieldGrid, type FieldDef } from "./FieldGrid";
import { AuditPanel } from "@/components/AuditPanel";
import { PageHeader, type Tone } from "@/components/ui";
import { newId } from "@/lib/ids";
import { countPeriodIssues } from "@/lib/profilPeriods";
import { nclcIssue } from "@/lib/profilFsw";
import { syncRows } from "@/lib/syncRows";
import { EditBar, changedFields, useEditable } from "@/components/editable";
import {
  IconBriefcase,
  IconDownload,
  IconGauge,
  IconGlobe,
  IconHome,
  IconInfo,
  IconMail,
  IconPrinter,
  IconRoute,
  IconShield,
  IconUser,
} from "@/components/icons";

export interface AuditSnapshot {
  steps: AuditInput["steps"];
  documents: AuditInput["documents"];
  gaps: AuditInput["gaps"];
  savings: AuditInput["savings"];
}

interface Props {
  dossier: Dossier;
  initialIdentity: Identity;
  /** Photo de profil ajoutée dans Compte et consentement. */
  avatarUrl: string | null;
  initialProfile: Profile;
  initialFsw: FswProfile;
  initialHistory: HistoryEntry[];
  initialAddresses: AddressEntry[];
  auditSnapshot: AuditSnapshot;
  /** NCLC estimé par épreuve d'après les tests TCF de la Formation. */
  tcfNclc?: Partial<Record<"co" | "ce" | "ee" | "eo", number>>;
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

const PROFILE_GROUPS: Array<{
  title: string;
  sub: string;
  icon: ReactNode;
  fields: Array<FieldDef<ProfileKey>>;
}> = [
  {
    title: "Projet",
    sub: "Programme, emploi visé et destination.",
    icon: <IconRoute size={15} />,
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
    sub: "Nationalité, famille et pièces.",
    icon: <IconUser size={15} />,
    fields: [
      { key: "nationalite", label: "Nationalité" },
      { key: "enfants", label: "Enfants" },
      {
        key: "passeport",
        label: "Passeport",
        placeholder: "Numéro, une fois délivré",
      },
      { key: "permis", label: "Permis de conduire" },
    ],
  },
  {
    title: "Coordonnées",
    sub: "Pour être joint par IRCC et les employeurs.",
    icon: <IconMail size={15} />,
    fields: [
      { key: "telephone", label: "Téléphone", type: "tel" },
      { key: "courriel", label: "Courriel", type: "email" },
      { key: "adresse", label: "Adresse actuelle" },
    ],
  },
];

const PROFILE_KEYS = PROFILE_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

const TABS = [
  { id: "identite", label: "Identité", icon: <IconUser size={15} /> },
  { id: "profil", label: "Profil", icon: <IconGlobe size={15} /> },
  { id: "grille", label: "Grille de points", icon: <IconGauge size={15} /> },
  { id: "historique", label: "Historique", icon: <IconBriefcase size={15} /> },
  { id: "adresses", label: "Adresses", icon: <IconHome size={15} /> },
  { id: "controle", label: "Contrôle", icon: <IconShield size={15} /> },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v);

const BADGE_CLASS: Record<Tone, string> = {
  ok: "bg-ok text-white",
  bad: "bg-bad text-white",
  opt: "bg-signal text-black",
  act: "bg-night-ink text-night",
  run: "bg-white/15 text-night-ink",
  todo: "bg-white/15 text-night-ink",
};

export function ProfilBoard({
  dossier,
  avatarUrl,
  initialIdentity,
  initialProfile,
  initialFsw,
  initialHistory,
  initialAddresses,
  auditSnapshot,
  tcfNclc,
}: Props) {
  const [identity, setIdentity] = useState(initialIdentity);
  const [profile, setProfile] = useState(initialProfile);
  const [fsw, setFsw] = useState(initialFsw);
  const [history, setHistory] = useState(initialHistory);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [tab, setTab] = useState<TabId>("identite");
  const supabase = createClient();

  // L'onglet suit l'ancre de l'URL (#grille, #historique…) pour pouvoir y revenir directement.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  function selectTab(id: TabId) {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  // Navigation clavier des onglets (motif ARIA) : flèches, Début, Fin.
  function onTabKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex((t) => t.id === tab);
    const last = TABS.length - 1;
    const to =
      e.key === "ArrowRight"
        ? i === last
          ? 0
          : i + 1
        : e.key === "ArrowLeft"
          ? i === 0
            ? last
            : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (to < 0) return;
    e.preventDefault();
    const id = TABS[to].id;
    selectTab(id);
    document.getElementById(`tab-${id}`)?.focus();
  }

  async function updateSingle<T extends object>(
    table: string,
    before: T,
    after: T,
  ) {
    const patch: Record<string, unknown> = changedFields(before, after);
    if (Object.keys(patch).length === 0) return;
    // Upsert : si la ligne n'existe pas encore, un simple update ne modifierait rien, sans erreur.
    const { error } = await supabase
      .from(table)
      .upsert(
        { dossier_id: dossier.id, ...patch },
        { onConflict: "dossier_id" },
      );
    if (error) throw error;
  }

  const periodsInvalid = (rows: Array<{ from: string; to: string }>) => {
    const n = countPeriodIssues(rows);
    return n
      ? `${n} ligne${n > 1 ? "s" : ""} avec des dates à corriger.`
      : null;
  };

  const idEd = useEditable(identity, async (d) => {
    await updateSingle("identity", identity, d);
    setIdentity(d);
  });
  const profileEd = useEditable(profile, async (d) => {
    await updateSingle("profile", profile, d);
    setProfile(d);
  });
  const fswEd = useEditable(
    fsw,
    async (d) => {
      await updateSingle("fsw", fsw, d);
      setFsw(d);
    },
    nclcIssue,
  );

  const histEd = useEditable(
    history,
    async (d) => {
      await syncRows(
        supabase,
        "history",
        history,
        d,
        (h) => ({
          from_date: h.from.trim(),
          to_date: h.to.trim(),
          type: h.type,
          activity: h.activity,
          org: h.org,
          place: h.place,
          parallel: h.parallel,
        }),
        { dossier_id: dossier.id },
      );
      setHistory(
        d.map((h) => ({ ...h, from: h.from.trim(), to: h.to.trim() })),
      );
    },
    periodsInvalid,
  );

  const addrEd = useEditable(
    addresses,
    async (d) => {
      await syncRows(
        supabase,
        "address",
        addresses,
        d,
        (a) => ({
          from_date: a.from.trim(),
          to_date: a.to.trim(),
          address: a.address,
          city: a.city,
          note: a.note,
          parallel: a.parallel,
        }),
        { dossier_id: dossier.id },
      );
      setAddresses(
        d.map((a) => ({ ...a, from: a.from.trim(), to: a.to.trim() })),
      );
    },
    periodsInvalid,
  );

  const histRows = histEd.current;
  const addrRows = addrEd.current;
  const histGaps = useMemo(
    () => historyGaps(histRows, identity.naissance),
    [histRows, identity.naissance],
  );
  const addrGaps = useMemo(
    () => addressGaps(addrRows, identity.naissance),
    [addrRows, identity.naissance],
  );

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

  // Complétude de la fiche, calculée sur les valeurs enregistrées.
  const idMissing = ID_FIELDS.filter(
    (f) => !String(identity[f.key] ?? "").trim(),
  ).length;
  const profileMissing = PROFILE_KEYS.filter(
    (k) => !String(profile[k] ?? "").trim(),
  ).length;
  const totalFields = ID_FIELDS.length + PROFILE_KEYS.length;
  const completeness = Math.round(
    ((totalFields - idMissing - profileMissing) / totalFields) * 100,
  );

  const fswTone: Tone =
    fswResult.status === "Admissible"
      ? "ok"
      : fswResult.status === "À compléter"
        ? "todo"
        : "bad";
  const badges: Record<TabId, { text: string; tone: Tone } | null> = {
    identite: idMissing ? { text: String(idMissing), tone: "opt" } : null,
    profil: profileMissing
      ? { text: String(profileMissing), tone: "opt" }
      : null,
    grille: { text: String(fswResult.total), tone: fswTone },
    historique: histGaps.length
      ? { text: String(histGaps.length), tone: "bad" }
      : null,
    adresses: addrGaps.length
      ? { text: String(addrGaps.length), tone: "bad" }
      : null,
    controle: auditItems.length
      ? { text: String(auditItems.length), tone: "opt" }
      : null,
  };
  const editingTab: Record<TabId, boolean> = {
    identite: idEd.editing,
    profil: profileEd.editing,
    grille: fswEd.editing,
    historique: histEd.editing,
    adresses: addrEd.editing,
    controle: false,
  };

  const idValues = (v: Identity) =>
    ({ ...v, naissance: v.naissance ?? "" }) as Record<IdKey, string>;
  const profileValues = (v: Profile) =>
    v as unknown as Record<ProfileKey, string>;

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
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-sm btn-primary"
            >
              <IconPrinter size={14} /> Imprimer la fiche
            </button>
          </div>
        }
      />

      <ProfileHeader
        identity={identity}
        profile={profile}
        completeness={completeness}
        missing={idMissing + profileMissing}
        fswTotal={fswResult.total}
        fswStatus={fswResult.status}
        avatarUrl={avatarUrl}
      >
        <div
          role="tablist"
          aria-label="Sections du profil"
          className="no-scrollbar -mb-px flex gap-1 overflow-x-auto px-3 sm:px-5"
        >
          {TABS.map((t) => {
            const on = tab === t.id;
            const badge = badges[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => selectTab(t.id)}
                onKeyDown={onTabKey}
                className={`relative flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  on
                    ? "bg-white/10 text-night-ink shadow-[inset_0_-2px_0_var(--signal)]"
                    : "text-night-muted hover:bg-white/5 hover:text-night-ink"
                }`}
              >
                {t.icon}
                {t.label}
                {badge && (
                  <span
                    aria-hidden
                    className={`mono rounded-full px-1.5 text-[10.5px] leading-[18px] font-semibold ${on ? "bg-white/20 text-night-ink" : BADGE_CLASS[badge.tone]}`}
                  >
                    {badge.text}
                  </span>
                )}
                {badge && (
                  <span className="sr-only">{badgeSr(t.id, badge.text)}</span>
                )}
                {editingTab[t.id] && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-signal"
                    title="Modification en cours"
                  >
                    <span className="sr-only">, modification en cours</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ProfileHeader>

      <div
        id={`panel-${tab}`}
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`tab-${tab}`}
        className="mt-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-act print:hidden"
      >
        {tab === "identite" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Panel
              icon={<IconUser size={18} />}
              title="Identité de référence"
              sub="À reproduire à l'identique sur chaque document et formulaire."
              editing={idEd.editing}
              actions={<EditBar edit={idEd} />}
            >
              <FieldGrid
                fields={ID_FIELDS}
                values={idValues(idEd.current)}
                editing={idEd.editing}
                onChange={(k, v) =>
                  idEd.set({
                    [k]: k === "naissance" ? v || null : v,
                  } as Partial<Identity>)
                }
              />
            </Panel>
            <Tips
              title="Règles d'écriture"
              items={[
                "Recopiez le nom et les prénoms exactement comme sur le passeport, dans le même ordre.",
                "Les noms des parents doivent correspondre à l'acte de naissance.",
                "Toute différence entre deux pièces doit être expliquée par une lettre ou un acte.",
                "Survolez une valeur pour la copier et la coller dans un formulaire en ligne.",
              ]}
            />
          </div>
        )}

        {tab === "profil" && (
          <Panel
            icon={<IconGlobe size={18} />}
            title="Profil Entrée express"
            sub="Les informations déclarées dans le profil en ligne."
            editing={profileEd.editing}
            actions={<EditBar edit={profileEd} />}
            bare
          >
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {PROFILE_GROUPS.map((g, i) => {
                const empty = g.fields.filter(
                  (f) => !String(profile[f.key] ?? "").trim(),
                ).length;
                return (
                  <section
                    key={g.title}
                    className={`card p-4 sm:p-5 ${i === 2 ? "xl:col-span-2" : ""} ${profileEd.editing ? "ring-2 ring-act-soft" : ""}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                          {g.icon}
                        </span>
                        <div>
                          <h3 className="text-[15px] font-bold">{g.title}</h3>
                          <p className="text-[12px] text-muted">{g.sub}</p>
                        </div>
                      </div>
                      <span
                        className={`mono shrink-0 text-[11.5px] ${empty ? "text-opt" : "text-ok"}`}
                      >
                        {g.fields.length - empty}/{g.fields.length}
                      </span>
                    </div>
                    <FieldGrid
                      fields={g.fields}
                      values={profileValues(profileEd.current)}
                      editing={profileEd.editing}
                      onChange={(k, v) =>
                        profileEd.set({ [k]: v } as Partial<Profile>)
                      }
                    />
                  </section>
                );
              })}
            </div>
          </Panel>
        )}

        {tab === "grille" && (
          <FswGrid
            fsw={fswEd.current}
            naissance={identity.naissance}
            profileDate={dossier.profileDate}
            history={history}
            tcfNclc={tcfNclc}
            editing={fswEd.editing}
            onChange={fswEd.set}
            actions={<EditBar edit={fswEd} />}
          />
        )}

        {tab === "historique" && (
          <HistoryTable
            rows={histRows}
            gaps={histGaps}
            naissance={identity.naissance}
            editing={histEd.editing}
            actions={<EditBar edit={histEd} />}
            onAdd={() =>
              histEd.update((d) => [
                ...d,
                {
                  id: newId("h"),
                  dossierId: dossier.id,
                  from: "",
                  to: "",
                  type: "Autre",
                  activity: "",
                  org: "",
                  place: "",
                  parallel: false,
                },
              ])
            }
            onUpdate={(id, patch) =>
              histEd.update((d) =>
                d.map((h) => (h.id === id ? { ...h, ...patch } : h)),
              )
            }
            onDelete={(id) =>
              histEd.update((d) => d.filter((h) => h.id !== id))
            }
          />
        )}

        {tab === "adresses" && (
          <AddressesTable
            rows={addrRows}
            gaps={addrGaps}
            naissance={identity.naissance}
            editing={addrEd.editing}
            actions={<EditBar edit={addrEd} />}
            onAdd={() =>
              addrEd.update((d) => [
                ...d,
                {
                  id: newId("a"),
                  dossierId: dossier.id,
                  from: "",
                  to: "",
                  address: "",
                  city: "",
                  note: "",
                  parallel: false,
                },
              ])
            }
            onUpdate={(id, patch) =>
              addrEd.update((d) =>
                d.map((a) => (a.id === id ? { ...a, ...patch } : a)),
              )
            }
            onDelete={(id) =>
              addrEd.update((d) => d.filter((a) => a.id !== id))
            }
          />
        )}

        {tab === "controle" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <AuditPanel items={auditItems} limit={100} />
            <Tips
              title="Comment lire ce contrôle"
              items={[
                "Bloquant : empêche de soumettre le dossier, à traiter en priorité.",
                "À traiter : incohérence ou échéance proche.",
                "À compléter : information manquante sans urgence.",
                "Le contrôle se met à jour dès que vous enregistrez une modification.",
              ]}
            />
          </div>
        )}
      </div>

      {/* Fiche imprimable : identité, profil, grille, historique et adresses, toujours en lecture (valeurs enregistrées). */}
      <div id="fiche-profil" className="hidden print:mt-6 print:block">
        <h2 className="mb-2 text-[16px] font-bold">Identité de référence</h2>
        <FieldGrid
          fields={ID_FIELDS}
          values={idValues(identity)}
          editing={false}
          onChange={() => {}}
        />
        {PROFILE_GROUPS.map((g) => (
          <div key={g.title} className="mt-5 break-inside-avoid">
            <h2 className="mb-2 text-[16px] font-bold">{g.title}</h2>
            <FieldGrid
              fields={g.fields}
              values={profileValues(profile)}
              editing={false}
              onChange={() => {}}
            />
          </div>
        ))}
        <div className="mt-5 break-inside-avoid">
          <h2 className="mb-1 text-[16px] font-bold">
            Grille des travailleurs qualifiés
          </h2>
          <p className="text-[13px]">
            <strong>{fswResult.total} / 100</strong> · {fswResult.status} ·
            seuil {FSW_PASS_THRESHOLD}
          </p>
        </div>
        <PrintPeriods
          title="Historique personnel"
          gaps={historyGaps(history, identity.naissance)}
          columns={["Du", "Au", "Type", "Activité", "Organisme · lieu"]}
          rows={sortByStart(history).map((h) => [
            h.from,
            h.to || "en cours",
            h.type,
            `${h.activity}${h.parallel ? " (en parallèle)" : ""}`,
            [h.org, h.place].filter(Boolean).join(" · "),
          ])}
        />
        <PrintPeriods
          title="Adresses"
          gaps={addressGaps(addresses, identity.naissance)}
          columns={["Du", "Au", "Adresse", "Ville, pays", "Note"]}
          rows={sortByStart(addresses).map((a) => [
            a.from,
            a.to || "actuelle",
            a.address,
            a.city,
            a.note,
          ])}
        />
      </div>
    </>
  );
}

function badgeSr(id: TabId, text: string): string {
  if (id === "grille") return `, ${text} points`;
  if (id === "historique" || id === "adresses") return `, ${text} trou(s)`;
  if (id === "controle") return `, ${text} point(s) de contrôle`;
  return `, ${text} champ(s) vide(s)`;
}

function sortByStart<T extends { from: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.from.localeCompare(b.from));
}

function PrintPeriods({
  title,
  columns,
  rows,
  gaps,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  gaps: string[];
}) {
  return (
    <div className="mt-5">
      <h2 className="mb-2 text-[16px] font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[12.5px]">Aucune ligne déclarée.</p>
      ) : (
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-b border-line px-1.5 py-1 text-left font-semibold"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="break-inside-avoid">
                {r.map((v, j) => (
                  <td
                    key={j}
                    className={`border-b border-line px-1.5 py-1 align-top ${j < 2 ? "mono whitespace-nowrap" : ""}`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-1.5 text-[11.5px]">
        {gaps.length
          ? `À justifier : ${gaps.join(" ; ")}`
          : "Aucun trou de plus de 4 jours."}
      </p>
    </div>
  );
}

function Panel({
  icon,
  title,
  sub,
  editing,
  actions,
  bare,
  children,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  editing: boolean;
  actions: ReactNode;
  bare?: boolean;
  children: ReactNode;
}) {
  const head = (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 ${bare ? "mb-4" : "mb-3"}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-act-soft text-act">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold">{title}</h2>
          <p className="text-[12.5px] text-muted">{sub}</p>
          {editing && (
            <p className="mt-1 text-[12px] font-semibold text-opt">
              Modification en cours — pensez à enregistrer.
            </p>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
  if (bare)
    return (
      <div>
        {head}
        {children}
      </div>
    );
  return (
    <section
      className={`card p-4 transition-shadow sm:p-6 ${editing ? "ring-2 ring-act-soft" : ""}`}
    >
      {head}
      {children}
    </section>
  );
}

function Tips({ title, items }: { title: string; items: string[] }) {
  return (
    <aside className="card self-start p-4 sm:p-5">
      <p className="flex items-center gap-2 text-[13px] font-bold">
        <IconInfo size={15} className="text-muted" /> {title}
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((t) => (
          <li
            key={t}
            className="flex gap-2 text-[12.5px] leading-relaxed text-muted"
          >
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" />
            {t}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ageFrom(naissance: string | null): number | null {
  const d = parseD(naissance);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  )
    age -= 1;
  return age;
}

function ProfileHeader({
  identity,
  profile,
  completeness,
  missing,
  fswTotal,
  fswStatus,
  avatarUrl,
  children,
}: {
  avatarUrl: string | null;
  identity: Identity;
  profile: Profile;
  completeness: number;
  missing: number;
  fswTotal: number;
  fswStatus: string;
  children: ReactNode;
}) {
  const fullName = [identity.prenoms, identity.nom].filter(Boolean).join(" ");
  const initials =
    (
      (identity.prenoms.trim()[0] ?? "") + (identity.nom.trim()[0] ?? "")
    ).toUpperCase() || "?";
  const age = ageFrom(identity.naissance);
  const born = parseD(identity.naissance);
  const facts = [
    born
      ? `Naissance : ${born.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${age != null ? ` · ${age} ans` : ""}`
      : null,
    profile.nationalite || null,
    identity.statut || null,
  ].filter(Boolean);
  const tags = [
    profile.titre,
    profile.cnp ? `CNP ${profile.cnp}` : "",
    profile.ville
      ? `${profile.ville}${profile.repli ? ` · repli ${profile.repli}` : ""}`
      : "",
  ].filter(Boolean);
  const scorePct = Math.min(100, fswTotal);

  return (
    <section className="overflow-hidden rounded-2xl bg-night text-night-ink print:rounded-none print:bg-transparent print:text-ink">
      <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 font-display text-[24px] font-bold ring-2 ring-white/15 sm:h-[76px] sm:w-[76px] sm:text-[28px] print:ring-line">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire du stockage privé
              <img
                src={avatarUrl}
                alt={fullName ? `Photo de ${fullName}` : "Photo de profil"}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-tight font-bold break-words sm:text-[26px]">
              {fullName || "Identité à compléter"}
            </h2>
            {facts.length > 0 && (
              <p className="mt-1 text-[13px] text-night-muted print:text-muted">
                {facts.join(" · ")}
              </p>
            )}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[12px] font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="no-print grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 xl:w-[360px]">
          <div className="bg-night-2 px-4 py-3.5">
            <p className="text-[11px] font-semibold tracking-wide text-night-muted uppercase">
              Grille de points
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="mono text-[26px] leading-none font-semibold">
                {fswTotal}
              </span>
              <span className="text-[12px] text-night-muted">/ 100</span>
            </p>
            <div
              className="relative mt-2.5 h-1 rounded-full bg-white/10"
              aria-hidden
            >
              <div
                className={`h-full rounded-full ${fswTotal >= FSW_PASS_THRESHOLD ? "bg-ok" : "bg-signal"}`}
                style={{ width: `${scorePct}%` }}
              />
              <span
                className="absolute -top-1 h-3 w-0.5 rounded bg-night-ink"
                style={{ left: `${FSW_PASS_THRESHOLD}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] text-night-muted">
              {fswStatus} · seuil {FSW_PASS_THRESHOLD}
            </p>
          </div>
          <div className="bg-night-2 px-4 py-3.5">
            <p className="text-[11px] font-semibold tracking-wide text-night-muted uppercase">
              Fiche complétée
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="mono text-[26px] leading-none font-semibold">
                {completeness}
              </span>
              <span className="text-[12px] text-night-muted">%</span>
            </p>
            <div className="mt-2.5 h-1 rounded-full bg-white/10" aria-hidden>
              <div
                className={`h-full rounded-full ${completeness === 100 ? "bg-ok" : "bg-night-ink"}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] text-night-muted">
              {missing ? `${missing} champ(s) vide(s)` : "complète"}
            </p>
          </div>
        </div>
      </div>
      <div className="no-print border-t border-white/10 pt-2">{children}</div>
    </section>
  );
}
