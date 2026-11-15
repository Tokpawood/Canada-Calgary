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
  PageHeader,
  TONE_DOT,
  fmtShortDate,
} from "@/components/ui";
import {
  IconAlert,
  IconCheck,
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
    const { error: insertError } = await supabase
      .from("document")
      .insert({ id, dossier_id: dossierId, name, position });
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
        position,
        checks: [],
        links: [],
        files: [],
      },
    ]);
    setNewName("");
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
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
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
              <ul className="card overflow-hidden">
                {filtered.map((d) => {
                  const checksDone = d.checks.filter((c) => c.done).length;
                  const needsCheck =
                    d.status === "Obtenu" && checksDone < d.checks.length;
                  return (
                    <li
                      key={d.id}
                      className="border-t border-line first:border-t-0"
                    >
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
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[14px] font-semibold">
                              {d.name}
                            </span>
                            {d.req === "Obligatoire" &&
                              d.status !== "Obtenu" && (
                                <span className="hidden text-[11px] font-semibold text-bad sm:inline">
                                  Obligatoire
                                </span>
                              )}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12px] text-muted">
                            {d.from && (
                              <span className="truncate">{d.from}</span>
                            )}
                            {d.checks.length > 0 && (
                              <span
                                className={`mono ${needsCheck ? "font-semibold text-opt" : ""}`}
                              >
                                {checksDone}/{d.checks.length} contrôles
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
                        <Chip tone={DOC_TONE[d.status]}>{d.status}</Chip>
                      </button>
                    </li>
                  );
                })}
              </ul>
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
