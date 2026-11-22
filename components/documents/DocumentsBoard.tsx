"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  DocumentRecord,
  DocumentStatus,
  Gap,
  Identity,
} from "@/lib/types";
import { newId } from "@/lib/ids";
import { nextStepPosition } from "@/lib/parcours";
import {
  Chip,
  DOC_TONE,
  EmptyState,
  Meter,
  PageHeader,
  TONE_DOT,
  fmtShortDate,
} from "@/components/ui";
import {
  DOCUMENT_STAGES,
  LATER_STAGES,
  groupByStage,
  guessStage,
  profileReadiness,
  stageOf,
  type DocumentStage,
} from "@/lib/documentStages";
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconPaperclip,
  IconPlus,
  IconShield,
} from "@/components/icons";
import {
  FilterBar,
  FilterChip,
  FilterDivider,
  FilterGroup,
  FilterSelect,
} from "@/components/FilterBar";
import {
  DarkHeader,
  DarkTiles,
  HeaderTabs,
  useHashTab,
} from "@/components/DarkHeader";
import { DocumentDrawer } from "./DocumentDrawer";
import { DocumentsSidePanel } from "./DocumentsSidePanel";
import { StatusMessage } from "@/components/coffre/StatusMessage";
import {
  EXPIRY_WARN_DAYS,
  expiringDocs,
  matchesDocQuery,
  obtainedWithPendingChecks,
  obtainedWithoutScan,
} from "@/lib/documents";

type FilterKey = "all" | DocumentStatus;
const STATUSES: DocumentStatus[] = ["Obtenu", "Demandé", "À obtenir"];

const TABS = ["pieces", "controles", "identite"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  initialDocuments: DocumentRecord[];
  dossierId: string;
  identity: Identity | null;
  initialGaps: Gap[];
}

export function DocumentsBoard({
  initialDocuments,
  dossierId,
  identity,
  initialGaps,
}: Props) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [gaps, setGaps] = useState(initialGaps);
  const [tab, setTab] = useHashTab<Tab>(TABS, "pieces");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [reqFilter, setReqFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addStage, setAddStage] = useState<DocumentStage | "">("");
  // Étapes repliées : les lointaines au départ, pour se concentrer sur le profil.
  const [folded, setFolded] = useState<Set<string>>(
    () => new Set<string>(LATER_STAGES),
  );
  const toggleFold = (id: string) =>
    setFolded((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const readiness = useMemo(() => profileReadiness(documents), [documents]);
  const [savingNew, setSavingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (filter !== "all" && d.status !== filter) return false;
      if (reqFilter !== "all" && d.req !== reqFilter) return false;
      return matchesDocQuery(d, query);
    });
  }, [documents, filter, reqFilter, query]);
  const withScans = documents.filter((d) => d.files.length > 0).length;

  const count = (s: DocumentStatus) =>
    documents.filter((d) => d.status === s).length;
  const mandatoryMissing = documents.filter(
    (d) => d.req === "Obligatoire" && d.status !== "Obtenu",
  ).length;
  const incompleteChecks = documents.filter(
    (d) => d.status === "Obtenu" && d.checks.some((c) => !c.done),
  ).length;
  const total = documents.length || 1;

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  function updateDoc(updated: DocumentRecord) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d)),
    );
  }

  async function addDocument() {
    const name = newName.trim();
    if (!name || savingNew) return;
    setSavingNew(true);
    setError(null);
    const id = newId("d");
    // Après le plus grand rang existant : le nombre de pièces retomberait sur un rang occupé après une suppression.
    const position = nextStepPosition(documents);
    // Étape choisie dans l'ajout, sinon devinée d'après le nom (modifiable ensuite dans la fiche).
    const stage = addStage || guessStage(name) || "";
    const { error: insertError } = await supabase
      .from("document")
      .insert({ id, dossier_id: dossierId, name, position, stage });
    setSavingNew(false);
    if (insertError) {
      setError(
        `Le document « ${name} » n'a pas pu être ajouté : ${insertError.message}`,
      );
      return;
    }
    setDocuments((prev) => [
      ...prev,
      {
        id,
        dossierId,
        name,
        status: "À obtenir",
        use: "",
        from: "",
        date: "",
        notes: "",
        req: "Obligatoire",
        format: "",
        validity: "",
        expires: "",
        stage,
        position,
        checks: [],
        links: [],
        files: [],
      },
    ]);
    setNewName("");
    setAddStage("");
    setAdding(false);
    setSelectedId(id);
  }

  const obtained = count("Obtenu");
  const toCheck = obtainedWithPendingChecks(documents);
  const toScan = obtainedWithoutScan(documents);
  const expiring = expiringDocs(documents);
  const openGaps = gaps.filter((g) => !g.done).length;

  async function toggleGap(id: string, done: boolean) {
    setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, done } : g)));
    const { error: gapError } = await supabase
      .from("gap")
      .update({ done })
      .eq("id", id);
    if (gapError) {
      setGaps((prev) =>
        prev.map((g) => (g.id === id ? { ...g, done: !done } : g)),
      );
      setError(`L'écart n'a pas pu être mis à jour : ${gapError.message}`);
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Documents"
        description="Pièces à réunir pour le profil et la demande de résidence permanente, avec leurs contrôles avant dépôt et leurs scans."
        actions={
          <button
            type="button"
            onClick={() => {
              setTab("pieces");
              setAdding(true);
            }}
            className="btn btn-primary"
          >
            <IconPlus size={16} /> Document
          </button>
        }
      />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              {
                label: "Obligatoires",
                value: mandatoryMissing ? String(mandatoryMissing) : "OK",
                sub: mandatoryMissing ? "encore manquants" : "tous obtenus",
                tone: mandatoryMissing ? "bad" : "ok",
              },
              {
                label: "Numérisées",
                value: String(withScans),
                unit: `/ ${documents.length}`,
                sub: "avec un scan au coffre",
                pct: documents.length
                  ? (withScans / documents.length) * 100
                  : 0,
                tone: "ok",
              },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Sections des documents"
            active={tab}
            onSelect={setTab}
            tabs={[
              {
                id: "pieces",
                label: "Pièces",
                icon: <IconFile size={15} />,
                badge: { text: String(documents.length) },
              },
              {
                id: "controles",
                label: "À contrôler",
                icon: <IconCheck size={15} />,
                badge:
                  incompleteChecks + toScan.length + expiring.length
                    ? {
                        text: String(
                          incompleteChecks + toScan.length + expiring.length,
                        ),
                        tone: expiring.some((e) => e.state === "expired")
                          ? "bad"
                          : "signal",
                      }
                    : null,
              },
              {
                id: "identite",
                label: "Identité & écarts",
                icon: <IconShield size={15} />,
                badge: openGaps
                  ? { text: String(openGaps), tone: "bad" }
                  : null,
              },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          Pièces obtenues
        </p>
        <p className="mt-1 font-display text-[52px] leading-none font-extrabold tracking-tight">
          {obtained}
          <span className="ml-1.5 text-[24px] text-night-muted">
            / {documents.length}
          </span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          {count("Demandé")} demandée(s) · {count("À obtenir")} à obtenir
        </p>
        <div
          className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-white/10"
          role="img"
          aria-label="Répartition des documents par statut"
        >
          {STATUSES.map((s) => {
            const n = count(s);
            if (!n || s === "À obtenir") return null;
            return (
              <span
                key={s}
                title={`${s} : ${n}`}
                className={`h-full ${s === "Obtenu" ? "bg-ok" : "bg-signal"}`}
                style={{ width: `${(n / total) * 100}%` }}
              />
            );
          })}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-night-muted">
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ok" /> Obtenu
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-signal" /> Demandé
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/20" /> À obtenir
          </li>
        </ul>
      </DarkHeader>

      <div className="mt-5" role="tabpanel">
        {error && (
          <StatusMessage
            tone="bad"
            onDismiss={() => setError(null)}
            className="mb-4"
          >
            {error}
          </StatusMessage>
        )}
        {tab === "controles" && (
          <section className="card overflow-hidden">
            <div className="px-4 pt-4 pb-3 sm:px-5">
              <h2 className="text-[16px] font-bold">Contrôles avant dépôt</h2>
              <p className="text-[12.5px] text-muted">
                Pièces obtenues dont certains contrôles ne sont pas encore
                cochés. Ouvrez une pièce pour les cocher.
              </p>
            </div>
            {toCheck.length === 0 ? (
              <p className="border-t border-line px-4 py-8 text-center text-[13px] text-muted">
                {obtained > 0
                  ? "Toutes les pièces obtenues sont contrôlées."
                  : "Aucune pièce obtenue pour l'instant : les contrôles à faire apparaîtront ici."}
              </p>
            ) : (
              <ul>
                {toCheck.map((d) => {
                  const pending = d.checks.filter((c) => !c.done);
                  const doneN = d.checks.length - pending.length;
                  return (
                    <li key={d.id} className="border-t border-line">
                      <button
                        type="button"
                        onClick={() => setSelectedId(d.id)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/70 sm:px-5"
                      >
                        <span className="mono mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-opt-bg text-[12px] font-bold text-opt">
                          {doneN}/{d.checks.length}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">
                            {d.name}
                          </span>
                          <span className="mt-1 flex flex-col gap-0.5">
                            {pending.slice(0, 3).map((c) => (
                              <span
                                key={c.id}
                                className="flex items-start gap-1.5 text-[12.5px] text-muted"
                              >
                                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-opt" />
                                {c.text}
                              </span>
                            ))}
                            {pending.length > 3 && (
                              <span className="text-[12px] text-faint">
                                et {pending.length - 3} autre(s)…
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "controles" && expiring.length > 0 && (
          <section className="card mt-4 overflow-hidden">
            <div className="px-4 pt-4 pb-3 sm:px-5">
              <h2 className="text-[16px] font-bold">Validité à surveiller</h2>
              <p className="text-[12.5px] text-muted">
                Pièces expirées ou qui expirent dans les {EXPIRY_WARN_DAYS}{" "}
                jours : à renouveler avant le dépôt.
              </p>
            </div>
            <ul>
              {expiring.map(({ doc: d, state, days }) => (
                <li key={d.id} className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/70 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {d.name}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        Valable jusqu&apos;au {fmtShortDate(d.expires)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${state === "expired" ? "bg-bad-bg text-bad" : "bg-signal-soft text-opt"}`}
                    >
                      {state === "expired"
                        ? "Expirée"
                        : days === 0
                          ? "Expire aujourd'hui"
                          : `Dans ${days} j`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "controles" && toScan.length > 0 && (
          <section className="card mt-4 overflow-hidden">
            <div className="px-4 pt-4 pb-3 sm:px-5">
              <h2 className="text-[16px] font-bold">
                Obtenues mais pas encore numérisées
              </h2>
              <p className="text-[12.5px] text-muted">
                Ces pièces n&apos;ont aucun scan au coffre. Ouvrez-en une pour
                déposer son scan (onglet Scans).
              </p>
            </div>
            <ul>
              {toScan.map((d) => (
                <li key={d.id} className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/70 sm:px-5"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"
                      aria-hidden
                    >
                      <IconPaperclip size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {d.name}
                      </span>
                      {d.from && (
                        <span className="block truncate text-[12px] text-muted">
                          {d.from}
                        </span>
                      )}
                    </span>
                    {d.req === "Obligatoire" && (
                      <span className="shrink-0 text-[11px] font-semibold text-bad">
                        Obligatoire
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "identite" && (
          <DocumentsSidePanel
            identity={identity}
            gaps={gaps}
            onToggleGap={(id, done) => void toggleGap(id, done)}
          />
        )}

        {tab === "pieces" && (
          <>
            {readiness.total > 0 && (
              <section
                className="card mb-4 overflow-hidden"
                aria-labelledby="pret-profil"
              >
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 pt-4 pb-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <h2 id="pret-profil" className="text-[16px] font-bold">
                      {readiness.done === readiness.total
                        ? "Prêt pour le profil Entrée express"
                        : "Prochaines pièces pour le profil Entrée express"}
                    </h2>
                    <p className="text-[12.5px] text-muted">
                      Pièces obligatoires des étapes 1 à 5 : elles servent à
                      remplir le profil et doivent être prêtes avant
                      l&apos;invitation.
                    </p>
                  </div>
                  <div className="w-full sm:w-56">
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="text-muted">Obtenues</span>
                      <span className="mono font-semibold">
                        {readiness.done}/{readiness.total}
                      </span>
                    </div>
                    <Meter
                      value={(readiness.done / readiness.total) * 100}
                      tone={readiness.done === readiness.total ? "ok" : "act"}
                      className="mt-1"
                      label={`Profil Entrée express : ${readiness.done} pièces obligatoires sur ${readiness.total}`}
                    />
                  </div>
                </div>
                {readiness.next.length > 0 && (
                  <ul className="border-t border-line">
                    {readiness.next.slice(0, 4).map((d) => {
                      const st = stageOf(d);
                      const i = DOCUMENT_STAGES.findIndex((x) => x.id === st);
                      return (
                        <li
                          key={d.id}
                          className="border-t border-line first:border-t-0"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(d.id)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/70 sm:px-5"
                          >
                            <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11.5px] font-bold text-muted">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold">
                                {d.name}
                              </span>
                              <span className="block truncate text-[12px] text-muted">
                                {d.status === "Demandé"
                                  ? `Demandé${d.from ? ` à ${d.from}` : ""} : relancer si besoin`
                                  : `À demander${d.from ? ` · ${d.from}` : ""}`}
                              </span>
                            </span>
                            <IconChevronRight
                              size={15}
                              className="shrink-0 text-muted"
                            />
                          </button>
                        </li>
                      );
                    })}
                    {readiness.next.length > 4 && (
                      <li className="border-t border-line px-4 py-2 text-[12px] text-muted sm:px-5">
                        et {readiness.next.length - 4} autre
                        {readiness.next.length - 4 > 1 ? "s" : ""} dans les
                        étapes ci-dessous.
                      </li>
                    )}
                  </ul>
                )}
              </section>
            )}
            <nav
              aria-label="Étapes de la procédure"
              className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {DOCUMENT_STAGES.map((st, i) => {
                const all = documents.filter((d) => stageOf(d) === st.id);
                const got = all.filter((d) => d.status === "Obtenu").length;
                const missing = all.filter(
                  (d) => d.req === "Obligatoire" && d.status !== "Obtenu",
                ).length;
                const complete = all.length > 0 && got === all.length;
                return (
                  <a
                    key={st.id}
                    href={`#etape-${st.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setFolded((f) => {
                        const n = new Set(f);
                        n.delete(st.id);
                        return n;
                      });
                      document
                        .getElementById(`etape-${st.id}`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    className="card flex flex-col gap-1.5 p-3 transition-colors hover:bg-surface-2/70"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`mono grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11.5px] font-bold ${complete ? "bg-ok-bg text-ok" : "bg-surface-2 text-muted"}`}
                        aria-hidden
                      >
                        {complete ? <IconCheck size={13} /> : i + 1}
                      </span>
                      <span className="min-w-0 text-[12.5px] leading-tight font-semibold">
                        {st.title}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
                        aria-hidden
                      >
                        <span
                          className={complete ? "bg-ok" : "bg-ink"}
                          style={{
                            width: `${all.length ? (got / all.length) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className="mono text-[11px] text-muted">
                        {got}/{all.length}
                      </span>
                    </span>
                    <span
                      className={`text-[11px] ${missing ? "font-semibold text-bad" : "text-faint"}`}
                    >
                      {missing
                        ? `${missing} obligatoire${missing > 1 ? "s" : ""} à obtenir`
                        : st.when}
                    </span>
                  </a>
                );
              })}
            </nav>
            <div className="mb-3">
              <FilterBar
                query={query}
                onQuery={setQuery}
                placeholder="Rechercher une pièce, un organisme, un usage…"
                searchLabel="Rechercher un document"
                meta={
                  filtered.length === documents.length
                    ? `${documents.length} pièces`
                    : `${filtered.length} sur ${documents.length}`
                }
                onReset={
                  filter !== "all" || reqFilter !== "all" || query
                    ? () => {
                        setFilter("all");
                        setReqFilter("all");
                        setQuery("");
                      }
                    : undefined
                }
              >
                <FilterGroup label="Filtrer par statut">
                  <FilterChip
                    active={filter === "all"}
                    onClick={() => setFilter("all")}
                    label="Tous"
                    count={documents.length}
                  />
                  <FilterChip
                    active={filter === "À obtenir"}
                    onClick={() => setFilter("À obtenir")}
                    label="À obtenir"
                    count={count("À obtenir")}
                  />
                  <FilterChip
                    active={filter === "Demandé"}
                    onClick={() => setFilter("Demandé")}
                    label="Demandés"
                    count={count("Demandé")}
                  />
                  <FilterChip
                    active={filter === "Obtenu"}
                    onClick={() => setFilter("Obtenu")}
                    label="Obtenus"
                    count={count("Obtenu")}
                  />
                </FilterGroup>
                <FilterDivider />
                <FilterSelect
                  label="Filtrer par caractère"
                  value={reqFilter}
                  onChange={setReqFilter}
                  icon={<IconAlert size={13} />}
                  options={[
                    { value: "all", label: "Tous caractères" },
                    { value: "Obligatoire", label: "Obligatoires" },
                    { value: "Conseillé", label: "Conseillés" },
                    { value: "Si applicable", label: "Si applicable" },
                  ]}
                />
              </FilterBar>
            </div>

            {adding && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addDocument();
                }}
                className="card anim-fade mb-3 flex flex-wrap items-end gap-2 p-4"
              >
                <label className="min-w-[220px] flex-1">
                  <span className="field-label">Nom du document</span>
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setAdding(false);
                    }}
                    maxLength={160}
                    placeholder="Ex. Relevé de notes du Bachelor"
                    className="input"
                  />
                </label>
                <label className="min-w-[200px]">
                  <span className="field-label">Étape</span>
                  <select
                    value={addStage}
                    onChange={(e) =>
                      setAddStage(e.target.value as DocumentStage | "")
                    }
                    className="input"
                  >
                    <option value="">Déduite du nom</option>
                    {DOCUMENT_STAGES.map((st, i) => (
                      <option key={st.id} value={st.id}>
                        {i + 1}. {st.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
                    setAddStage("");
                  }}
                  className="btn btn-ghost"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || savingNew}
                  className="btn btn-primary"
                >
                  {savingNew ? "Ajout…" : "Ajouter"}
                </button>
              </form>
            )}

            {filtered.length === 0 ? (
              <EmptyState icon={<IconFile size={20} />} title="Aucun document">
                {documents.length === 0
                  ? "Ajoutez votre première pièce avec le bouton « Document » (passeport, diplômes, relevés…)."
                  : query
                    ? "Aucun résultat pour cette recherche."
                    : "Aucun document dans cette catégorie."}
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {groupByStage(filtered).map(({ stage, docs }) => {
                  const key = stage?.id ?? "aclasser";
                  const n = stage ? DOCUMENT_STAGES.indexOf(stage) + 1 : null;
                  const all = documents.filter(
                    (d) => stageOf(d) === (stage?.id ?? null),
                  );
                  const got = all.filter((d) => d.status === "Obtenu").length;
                  const complete = all.length > 0 && got === all.length;
                  const missing = all.filter(
                    (d) => d.req === "Obligatoire" && d.status !== "Obtenu",
                  ).length;
                  // Recherche ou filtre actif : tout est déplié pour voir les résultats.
                  const searching =
                    filter !== "all" || reqFilter !== "all" || !!query;
                  const isFolded = !searching && folded.has(key);
                  return (
                    <section
                      key={key}
                      id={`etape-${key}`}
                      className="card scroll-mt-4 overflow-hidden"
                      aria-labelledby={`etape-${key}-t`}
                    >
                      <header
                        className={`flex cursor-pointer flex-wrap items-start gap-3 px-4 pt-4 sm:px-5 ${isFolded ? "pb-4" : "pb-3"}`}
                        onClick={() => toggleFold(key)}
                      >
                        <span
                          className={`mono grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[14px] font-bold ${complete ? "bg-ok-bg text-ok" : "bg-night text-night-ink"}`}
                          aria-hidden
                        >
                          {complete ? <IconCheck size={16} /> : (n ?? "?")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h2
                              id={`etape-${key}-t`}
                              className="text-[16px] font-bold"
                            >
                              {stage?.title ?? "À classer"}
                            </h2>
                            {stage && (
                              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                                {stage.when}
                              </span>
                            )}
                            <button
                              type="button"
                              aria-expanded={!isFolded}
                              aria-controls={`etape-${key}-l`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFold(key);
                              }}
                              className="ml-auto inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[12px] font-semibold text-muted hover:bg-surface-2 sm:ml-0"
                            >
                              <IconChevronDown
                                size={14}
                                className={`transition-transform ${isFolded ? "-rotate-90" : ""}`}
                              />
                              {isFolded
                                ? `Afficher ${docs.length} pièce${docs.length > 1 ? "s" : ""}`
                                : "Replier"}
                            </button>
                          </div>
                          <p className="mt-0.5 text-[12.5px] text-muted">
                            {stage?.desc ??
                              "Pièces sans étape : ouvrez-en une pour choisir son étape."}
                          </p>
                        </div>
                        <div className="w-full sm:w-44">
                          <div className="flex items-baseline justify-between gap-2 text-[12px]">
                            {missing ? (
                              <span className="font-semibold text-bad">
                                {missing} obligatoire{missing > 1 ? "s" : ""} à
                                obtenir
                              </span>
                            ) : (
                              <span className="text-muted">Obtenues</span>
                            )}
                            <span className="mono font-semibold">
                              {got}/{all.length}
                            </span>
                          </div>
                          <Meter
                            value={all.length ? (got / all.length) * 100 : 0}
                            tone={complete ? "ok" : "act"}
                            className="mt-1"
                            label={`${stage?.title ?? "À classer"} : ${got} sur ${all.length} obtenues`}
                          />
                        </div>
                      </header>
                      {!isFolded && (
                        <ul id={`etape-${key}-l`}>
                          {docs.map((d) => {
                            const checksDone = d.checks.filter(
                              (c) => c.done,
                            ).length;
                            const needsCheck =
                              d.status === "Obtenu" &&
                              checksDone < d.checks.length;
                            return (
                              <li key={d.id} className="border-t border-line">
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(d.id)}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/70 sm:px-5"
                                >
                                  <span
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[DOC_TONE[d.status]]} ${d.status === "À obtenir" ? "opacity-40" : ""}`}
                                    aria-hidden
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-x-2">
                                      <span className="text-[14px] font-semibold">
                                        {d.name}
                                      </span>
                                      {d.req === "Obligatoire" ? (
                                        d.status !== "Obtenu" && (
                                          <span className="text-[11px] font-semibold text-bad">
                                            Obligatoire
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-[11px] font-semibold text-faint">
                                          {d.req}
                                        </span>
                                      )}
                                    </span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12px] text-muted">
                                      {d.from && (
                                        <span className="truncate">
                                          {d.from}
                                        </span>
                                      )}
                                      {d.checks.length > 0 && (
                                        <span
                                          className={`mono ${needsCheck ? "font-semibold text-opt" : ""}`}
                                        >
                                          {checksDone}/{d.checks.length}{" "}
                                          contrôles
                                        </span>
                                      )}
                                      {d.files.length > 0 && (
                                        <span className="inline-flex items-center gap-1">
                                          <IconPaperclip size={12} />
                                          {d.files.length} scan
                                          {d.files.length > 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </span>
                                  </span>
                                  <Chip tone={DOC_TONE[d.status]}>
                                    {d.status}
                                  </Chip>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {stage && !isFolded && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddStage(stage.id);
                            setAdding(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[12.5px] font-semibold text-muted hover:bg-surface-2/70 sm:px-5"
                        >
                          <IconPlus size={14} /> Ajouter une pièce à cette étape
                        </button>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <DocumentDrawer
          key={selected.id}
          doc={selected}
          onChange={updateDoc}
          onDelete={() => {
            setDocuments((prev) => prev.filter((d) => d.id !== selected.id));
            setSelectedId(null);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
