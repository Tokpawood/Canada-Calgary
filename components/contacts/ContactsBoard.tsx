"use client";

import { useEffect, useState, type DragEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact, ContactStage, Step } from "@/lib/types";
import { CONTACT_STAGES, type ContactPerson, type ContactStepLink } from "@/lib/network";
import { newId } from "@/lib/ids";
import { EmptyState, Field, PageHeader, STEP_TONE, TONE_DOT } from "@/components/ui";
import { IconArrowRight, IconCheck, IconChevronRight, IconLink, IconPlus, IconSearch, IconUser, IconUsers } from "@/components/icons";
import { DarkHeader, DarkTiles, HeaderTabs, useHashTab } from "@/components/DarkHeader";
import { CopyButton } from "@/components/profil/FieldGrid";
import { initials } from "./contactLink";
import { OrgDrawer, STAGE_DOT, type OrgTab } from "./OrgDrawer";
import { StepPeek } from "./StepPeek";

const TABS = ["organismes", "reseau", "a-relancer"] as const;
type Tab = (typeof TABS)[number];
type View = "liste" | "kanban";
type Panel = { kind: "org"; id: string; tab: OrgTab } | { kind: "step"; id: string; back?: { orgId: string; tab: OrgTab } } | null;

const VIEW_KEY = "pcc-contacts-view";
const stageLabel = (s: ContactStage) => CONTACT_STAGES.find((x) => x.id === s)?.label ?? s;

interface Props {
  dossierId: string;
  initialContacts: Contact[];
  initialPersons: ContactPerson[];
  initialLinks: ContactStepLink[];
  steps: Step[];
}

export function ContactsBoard({ dossierId, initialContacts, initialPersons, initialLinks, steps: initialSteps }: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [persons, setPersons] = useState(initialPersons);
  const [links, setLinks] = useState(initialLinks);
  const [steps, setSteps] = useState(initialSteps);
  const [panel, setPanel] = useState<Panel>(null);
  const [view, setViewState] = useState<View>("liste");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useHashTab<Tab>(TABS, "organismes");
  const supabase = createClient();

  useEffect(() => {
    // Après l'hydratation : la vue choisie la dernière fois sur cet appareil.
    const raf = requestAnimationFrame(() => {
      try {
        const v = localStorage.getItem(VIEW_KEY);
        if (v === "kanban" || v === "liste") setViewState(v);
      } catch {
        /* stockage indisponible : vue liste */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  function setView(v: View) {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* rien */
    }
  }

  async function createContact(org: string, role: string, stage: ContactStage) {
    const id = newId("c");
    const row: Contact = { id, dossierId, org, role, contact: "", person: "", next: "", notes: "", stage };
    const { error } = await supabase.from("contact").insert({ id, dossier_id: dossierId, position: contacts.length, org, role, stage });
    if (error) throw new Error("Création impossible.");
    setContacts((prev) => [...prev, row]);
    setAdding(false);
    setPanel({ kind: "org", id, tab: "equipe" });
  }

  async function patchContact(id: string, patch: Partial<Contact>) {
    if (!Object.keys(patch).length) return;
    const { error } = await supabase.from("contact").update(patch).eq("id", id);
    if (error) throw new Error("Enregistrement impossible.");
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function deleteContact(id: string) {
    const { error } = await supabase.from("contact").delete().eq("id", id);
    if (error) throw new Error("Suppression impossible.");
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setPersons((prev) => prev.filter((p) => p.contactId !== id));
    setLinks((prev) => prev.filter((l) => l.contactId !== id));
    setPanel(null);
  }

  /** Une personne retirée emporte ses liens vers les étapes (cascade en base). */
  function setOrgPersons(contactId: string, next: ContactPerson[]) {
    const kept = new Set(next.map((p) => p.id));
    setPersons((prev) => [...prev.filter((p) => p.contactId !== contactId), ...next]);
    setLinks((prev) => prev.filter((l) => l.contactId !== contactId || !l.personId || kept.has(l.personId)));
  }

  const withNext = contacts.filter((c) => c.next.trim()).length;
  const linkedSteps = new Set(links.map((l) => l.stepId)).size;
  const orgName = new Map(contacts.map((c) => [c.id, c.org || "Sans nom"]));
  const stepOf = new Map(steps.map((s) => [s.id, s]));

  const q = query.trim().toLowerCase();
  const orgText = (c: Contact) =>
    `${c.org} ${c.role} ${c.contact} ${c.next} ${c.notes} ${stageLabel(c.stage)} ${persons
      .filter((p) => p.contactId === c.id)
      .map((p) => `${p.name} ${p.title} ${p.email} ${p.phone}`)
      .join(" ")}`.toLowerCase();
  const visible = contacts.filter((c) => (!q || orgText(c).includes(q)) && (tab !== "a-relancer" || c.next.trim()));
  const personSteps = (id: string) => links.filter((l) => l.personId === id).map((l) => stepOf.get(l.stepId)).filter((s): s is Step => !!s);
  const visiblePeople = persons
    .filter((p) => !q || `${p.name} ${p.title} ${p.email} ${p.phone} ${orgName.get(p.contactId) ?? ""} ${personSteps(p.id).map((s) => s.title).join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => (orgName.get(a.contactId) ?? "").localeCompare(orgName.get(b.contactId) ?? "", "fr") || a.name.localeCompare(b.name, "fr"));
  const shown = tab === "reseau" ? visiblePeople.length : visible.length;
  const total = tab === "reseau" ? persons.length : contacts.length;

  const openOrg = (id: string, t: OrgTab = "equipe") => setPanel({ kind: "org", id, tab: t });
  const panelOrg = panel?.kind === "org" ? contacts.find((c) => c.id === panel.id) : undefined;
  const panelStep = panel?.kind === "step" ? stepOf.get(panel.id) : undefined;

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Organismes, personnes qui peuvent vous aider et tâches où elles interviennent."
        actions={
          <button
            type="button"
            onClick={() => {
              if (tab !== "organismes") setTab("organismes");
              setAdding(true);
            }}
            disabled={adding}
            className="btn btn-primary"
          >
            <IconPlus size={16} /> Organisme
          </button>
        }
      />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              { label: "Actions en attente", value: String(withNext), sub: withNext ? "prochaines actions à mener" : "rien à relancer", tone: withNext ? "signal" : undefined },
              { label: "Tâches liées", value: String(linkedSteps), unit: `/ ${steps.length}`, sub: "étapes avec un contact", pct: steps.length ? (linkedSteps / steps.length) * 100 : 0, tone: "ok" },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Vues des contacts"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "organismes", label: "Organismes", icon: <IconUsers size={15} />, badge: { text: String(contacts.length) } },
              { id: "reseau", label: "Réseau", icon: <IconUser size={15} />, badge: persons.length ? { text: String(persons.length) } : null },
              { id: "a-relancer", label: "À relancer", icon: <IconArrowRight size={15} />, badge: withNext ? { text: String(withNext), tone: "signal" } : null },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">Réseau du dossier</p>
        <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight sm:text-[52px]">
          {persons.length}
          <span className="ml-2 text-[20px] font-bold text-signal">personne{persons.length > 1 ? "s" : ""}</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          dans {contacts.length} organisme{contacts.length > 1 ? "s" : ""}
          {links.length ? ` · ${links.length} lien${links.length > 1 ? "s" : ""} avec le parcours` : ""}
        </p>
        {contacts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {CONTACT_STAGES.map((s) => {
              const n = contacts.filter((c) => c.stage === s.id).length;
              return n ? (
                <span key={s.id} className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-[12px] font-semibold">
                  <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[s.id]}`} />
                  {s.label} <span className="font-normal text-night-muted">{n}</span>
                </span>
              ) : null;
            })}
          </div>
        )}
      </DarkHeader>

      <div className="mt-5" role="tabpanel">
        {adding && <NewOrgForm onCreate={createContact} onCancel={() => setAdding(false)} />}

        {contacts.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="card flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
              <IconSearch size={16} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un organisme, une personne, une tâche…"
                aria-label="Rechercher un contact"
                className="min-w-0 flex-1 bg-transparent py-1 text-[14px] outline-none placeholder:text-faint"
              />
              <span className="mono shrink-0 text-[12px] text-muted">
                {shown} / {total}
              </span>
            </div>
            {tab === "organismes" && (
              <div role="radiogroup" aria-label="Affichage des organismes" className="card flex shrink-0 gap-1 p-1">
                {(["liste", "kanban"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={view === v}
                    onClick={() => setView(v)}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${view === v ? "bg-act text-white" : "text-muted hover:bg-surface-2"}`}
                  >
                    {v === "liste" ? "Liste" : "Kanban"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {contacts.length === 0 ? (
          !adding && (
            <EmptyState icon={<IconUsers size={20} />} title="Aucun organisme">
              Ajoutez les organismes avec lesquels vous échangez (ambassade, école, employeur, centre de tests…), puis les personnes qui peuvent vous aider dans chacun.
            </EmptyState>
          )
        ) : tab === "reseau" ? (
          visiblePeople.length === 0 ? (
            <EmptyState icon={<IconUser size={20} />} title={q ? "Aucune personne trouvée" : "Aucune personne"}>
              {q ? "Essayez une autre recherche." : "Ouvrez un organisme et ajoutez-y les personnes qui peuvent vous aider."}
            </EmptyState>
          ) : (
            <PeopleList
              persons={visiblePeople}
              all={persons}
              orgName={orgName}
              stepsOf={personSteps}
              onOpenOrg={(id) => openOrg(id, "equipe")}
              onOpenStep={(id) => setPanel({ kind: "step", id })}
            />
          )
        ) : visible.length === 0 ? (
          <EmptyState icon={<IconUsers size={20} />} title={tab === "a-relancer" && !q ? "Rien à relancer" : "Aucun organisme trouvé"}>
            {tab === "a-relancer" && !q ? "Aucun organisme n'a de prochaine action." : "Essayez une autre recherche."}
          </EmptyState>
        ) : tab === "organismes" && view === "kanban" ? (
          <Kanban contacts={visible} persons={persons} links={links} onOpen={(id) => openOrg(id)} onMove={(id, stage) => void patchContact(id, { stage })} />
        ) : (
          <OrgList contacts={visible} persons={persons} links={links} onOpen={(id) => openOrg(id, tab === "a-relancer" ? "infos" : "equipe")} />
        )}
      </div>

      {panel?.kind === "org" && panelOrg && (
        <OrgDrawer
          key={panelOrg.id}
          contact={panelOrg}
          persons={persons.filter((p) => p.contactId === panelOrg.id)}
          links={links.filter((l) => l.contactId === panelOrg.id)}
          steps={steps}
          initialTab={panel.tab}
          onSave={(patch) => patchContact(panelOrg.id, patch)}
          onDelete={() => deleteContact(panelOrg.id)}
          onPersons={(next) => setOrgPersons(panelOrg.id, next)}
          onLinkAdd={(l) => setLinks((prev) => [...prev, l])}
          onLinkRemove={(id) => setLinks((prev) => prev.filter((l) => l.id !== id))}
          onOpenStep={(id) => setPanel({ kind: "step", id, back: { orgId: panelOrg.id, tab: "taches" } })}
          onClose={() => setPanel(null)}
        />
      )}

      {panel?.kind === "step" && panelStep && (
        <StepPeek
          key={panelStep.id}
          step={panelStep}
          contacts={contacts}
          persons={persons}
          links={links.filter((l) => l.stepId === panelStep.id)}
          backLabel={panel.back ? orgName.get(panel.back.orgId) : undefined}
          onBack={panel.back ? () => panel.back && openOrg(panel.back.orgId, panel.back.tab) : undefined}
          onOpenPerson={(pid) => {
            const p = persons.find((x) => x.id === pid);
            if (p) openOrg(p.contactId, "equipe");
          }}
          onOpenOrg={(cid) => openOrg(cid, "taches")}
          onChange={(s) => setSteps((prev) => prev.map((x) => (x.id === s.id ? s : x)))}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}

function NewOrgForm({ onCreate, onCancel }: { onCreate: (org: string, role: string, stage: ContactStage) => Promise<void>; onCancel: () => void }) {
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [stage, setStage] = useState<ContactStage>("a-contacter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card anim-fade mb-4 p-4 ring-2 ring-act-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!org.trim()) return setError("Donnez un nom à l'organisme.");
        setBusy(true);
        setError(null);
        try {
          await onCreate(org.trim(), role.trim(), stage);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Création impossible.");
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Organisme">
          <input autoFocus value={org} onChange={(e) => setOrg(e.target.value)} placeholder="IRCC, école, employeur…" className="input" />
        </Field>
        <Field label="Type / rôle">
          <input value={role} onChange={(e) => setRole(e.target.value)} className="input" />
        </Field>
        <Field label="Étape">
          <select value={stage} onChange={(e) => setStage(e.target.value as ContactStage)} className="input">
            {CONTACT_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {error && <span className="text-[12px] text-bad">{error}</span>}
        <button type="button" onClick={onCancel} disabled={busy} className="btn btn-sm btn-ghost">
          Annuler
        </button>
        <button type="submit" disabled={busy} className="btn btn-sm btn-primary">
          <IconCheck size={14} /> {busy ? "Création…" : "Créer et ouvrir"}
        </button>
      </div>
    </form>
  );
}

function TeamDots({ persons }: { persons: ContactPerson[] }) {
  if (!persons.length) return <span className="text-[12px] text-faint">Personne</span>;
  return (
    <span className="flex items-center">
      {persons.slice(0, 4).map((p, i) => (
        <span
          key={p.id}
          title={p.name}
          className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-[10.5px] font-bold text-muted ring-2 ring-surface"
          style={{ marginLeft: i ? -8 : 0 }}
        >
          {initials(p.name)}
        </span>
      ))}
      {persons.length > 4 && <span className="ml-1.5 text-[12px] text-muted">+{persons.length - 4}</span>}
    </span>
  );
}

function StagePill({ stage }: { stage: ContactStage }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[stage]}`} />
      {stageLabel(stage)}
    </span>
  );
}

function OrgList({ contacts, persons, links, onOpen }: { contacts: Contact[]; persons: ContactPerson[]; links: ContactStepLink[]; onOpen: (id: string) => void }) {
  return (
    <section className="card overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_9.5rem_8rem_5.5rem_minmax(0,2fr)_1.5rem] gap-3 border-b border-line px-5 py-2 text-[11.5px] font-medium text-muted md:grid">
        <span>Organisme</span>
        <span>Étape</span>
        <span>Équipe</span>
        <span>Tâches</span>
        <span>Prochaine action</span>
        <span />
      </div>
      <ul>
        {contacts.map((c) => {
          const team = persons.filter((p) => p.contactId === c.id);
          const n = links.filter((l) => l.contactId === c.id).length;
          return (
            <li key={c.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-surface-2/60 sm:px-5 md:grid-cols-[minmax(0,2.2fr)_9.5rem_8rem_5.5rem_minmax(0,2fr)_1.5rem]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-act-soft font-display text-[14px] font-bold text-act">{(c.org.trim()[0] ?? "?").toUpperCase()}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-bold">{c.org || "Organisme sans nom"}</span>
                    <span className="block truncate text-[12px] text-muted">{c.role || "—"}</span>
                  </span>
                </span>
                <span className="justify-self-end md:justify-self-start">
                  <StagePill stage={c.stage} />
                </span>
                <span className="col-span-2 flex items-center gap-4 md:col-span-1 md:contents">
                  <TeamDots persons={team} />
                  <span className="mono inline-flex items-center gap-1 text-[12.5px] text-muted">
                    <IconLink size={13} className="md:hidden" />
                    {n || "—"}
                    <span className="md:hidden">tâche{n > 1 ? "s" : ""}</span>
                  </span>
                </span>
                <span className={`col-span-2 truncate text-[12.5px] md:col-span-1 ${c.next ? "text-opt" : "text-faint"}`}>{c.next || "—"}</span>
                <IconChevronRight size={16} className="hidden text-faint md:block" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Kanban({
  contacts,
  persons,
  links,
  onOpen,
  onMove,
}: {
  contacts: Contact[];
  persons: ContactPerson[];
  links: ContactStepLink[];
  onOpen: (id: string) => void;
  onMove: (id: string, stage: ContactStage) => void;
}) {
  const [over, setOver] = useState<ContactStage | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function drop(e: DragEvent, stage: ContactStage) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setOver(null);
    setDragId(null);
    const c = contacts.find((x) => x.id === id);
    if (c && c.stage !== stage) onMove(c.id, stage);
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3">
        {CONTACT_STAGES.map((s) => {
          const list = contacts.filter((c) => c.stage === s.id);
          return (
            <section
              key={s.id}
              aria-label={s.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => drop(e, s.id)}
              className={`flex min-h-[220px] flex-col rounded-2xl border p-2.5 transition-colors ${over === s.id ? "border-act bg-act-soft/40" : "border-line bg-surface-2/40"}`}
            >
              <header className="mb-2 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${STAGE_DOT[s.id]}`} />
                <h3 className="text-[13px] font-bold">{s.label}</h3>
                <span className="mono ml-auto text-[12px] text-muted">{list.length}</span>
              </header>
              <p className="mb-2 px-1 text-[11.5px] text-faint">{s.hint}</p>
              <ul className="flex flex-col gap-2">
                {list.map((c) => {
                  const team = persons.filter((p) => p.contactId === c.id);
                  const n = links.filter((l) => l.contactId === c.id).length;
                  return (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(c.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={dragId === c.id ? "opacity-50" : ""}
                    >
                      <button type="button" onClick={() => onOpen(c.id)} className="card block w-full cursor-grab p-3 text-left hover:border-act/40 active:cursor-grabbing">
                        <span className="block truncate text-[14px] font-bold">{c.org || "Organisme sans nom"}</span>
                        {c.role && <span className="block truncate text-[12px] text-muted">{c.role}</span>}
                        {c.next && <span className="mt-2 line-clamp-2 block rounded-lg bg-signal-soft px-2 py-1 text-[12px] text-opt">{c.next}</span>}
                        <span className="mt-2.5 flex items-center justify-between gap-2">
                          <TeamDots persons={team} />
                          {n > 0 && (
                            <span className="mono inline-flex items-center gap-1 text-[12px] text-muted">
                              <IconLink size={12} /> {n}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {list.length === 0 && <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-faint">Glissez un organisme ici</p>}
            </section>
          );
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Glissez une carte d&apos;une colonne à l&apos;autre, ou changez l&apos;étape dans la fiche de l&apos;organisme.</p>
    </div>
  );
}

function PeopleList({
  persons,
  all,
  orgName,
  stepsOf,
  onOpenOrg,
  onOpenStep,
}: {
  persons: ContactPerson[];
  all: ContactPerson[];
  orgName: Map<string, string>;
  stepsOf: (personId: string) => Step[];
  onOpenOrg: (contactId: string) => void;
  onOpenStep: (stepId: string) => void;
}) {
  const nameOf = new Map(all.map((p) => [p.id, p.name]));
  return (
    <section className="card overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,2fr)] gap-3 border-b border-line px-5 py-2 text-[11.5px] font-medium text-muted lg:grid">
        <span>Personne</span>
        <span>Organisme</span>
        <span>Coordonnées</span>
        <span>Tâches liées</span>
      </div>
      <ul>
        {persons.map((p) => {
          const tasks = stepsOf(p.id);
          return (
            <li key={p.id} className="grid grid-cols-1 gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,2fr)] lg:gap-3">
              <button type="button" onClick={() => onOpenOrg(p.contactId)} className="flex min-w-0 items-center gap-2.5 text-left">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-muted">{initials(p.name)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold hover:text-act hover:underline">{p.name}</span>
                  {(p.title || p.parentId) && (
                    <span className="block truncate text-[12px] text-muted">
                      {p.title}
                      {p.parentId && nameOf.get(p.parentId) ? `${p.title ? " · " : ""}sous ${nameOf.get(p.parentId)}` : ""}
                    </span>
                  )}
                </span>
              </button>
              <button type="button" onClick={() => onOpenOrg(p.contactId)} className="truncate text-left text-[13px] font-medium text-act hover:underline lg:self-center">
                {orgName.get(p.contactId)}
              </button>
              <span className="flex min-w-0 flex-col gap-0.5 text-[13px] lg:self-center">
                {p.email && (
                  <span className="flex min-w-0 items-center gap-1">
                    <a href={`mailto:${p.email}`} className="truncate font-medium text-act hover:underline">
                      {p.email}
                    </a>
                    <CopyButton text={p.email} label={`courriel ${p.name}`} />
                  </span>
                )}
                {p.phone && (
                  <span className="flex items-center gap-1">
                    <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-act hover:underline">
                      {p.phone}
                    </a>
                    <CopyButton text={p.phone} label={`téléphone ${p.name}`} />
                  </span>
                )}
                {!p.email && !p.phone && <span className="text-faint">—</span>}
              </span>
              <span className="flex min-w-0 flex-wrap gap-1.5 lg:self-center">
                {tasks.length === 0 ? (
                  <span className="text-[12.5px] text-faint">Aucune tâche</span>
                ) : (
                  tasks.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onOpenStep(s.id)}
                      title={`${s.title} · ${s.status}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium hover:border-act hover:text-act"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[STEP_TONE[s.status]]}`} />
                      <span className="truncate">{s.title}</span>
                    </button>
                  ))
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
