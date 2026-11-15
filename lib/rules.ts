import type {
  AddressEntry,
  Contact,
  Dossier,
  DocumentRecord,
  FswProfile,
  HistoryEntry,
  Saving,
  Step,
  StepStatus,
} from "./types";

const DAY_MS = 86400000;
const MONTH_DAYS = 30.4375; // 365,25 / 12, utilisé par le prototype pour l'expérience qualifiée

// ---------- dates ----------

/** Format strict AAAA-MM-JJ utilisé pour `step.due` (pas de mois seul). */
export function parseD(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parts = String(iso).split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseD(iso);
  if (!d) return null;
  return Math.round((d.getTime() - localMidnight(now).getTime()) / DAY_MS);
}

const MONTH_ISO_RE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

/** Format AAAA-MM-JJ ou AAAA-MM (jour inconnu), utilisé pour historique/adresses/naissance. En UTC. */
export function pd(v: string | null | undefined, end = false): Date | null {
  const m = MONTH_ISO_RE.exec(String(v ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (m[3]) return new Date(Date.UTC(y, mo, Number(m[3])));
  return end ? new Date(Date.UTC(y, mo + 1, 0)) : new Date(Date.UTC(y, mo, 1));
}

export function today0(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function fmtD(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function isoFromUTC(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** Le prototype codait en dur "2018-08-22" (18 ans de son unique titulaire) ; ici on le dérive de la date de naissance pour rester générique. */
export function eighteenthBirthdayIso(naissanceIso: string | null | undefined): string | null {
  const b = pd(naissanceIso);
  if (!b) return null;
  return isoFromUTC(new Date(Date.UTC(b.getUTCFullYear() + 18, b.getUTCMonth(), b.getUTCDate())));
}

// ---------- étapes : statut, avancement, retard ----------

export function isOpenStep(status: StepStatus): boolean {
  return status !== "Fait" && status !== "Si nécessaire";
}

export function isLate(step: Pick<Step, "status" | "due">, now: Date = new Date()): boolean {
  const d = daysUntil(step.due, now);
  return isOpenStep(step.status) && d !== null && d < 0;
}

interface StepProgressLike {
  status: StepStatus;
  tasks: Array<{ done: boolean }>;
}

export function stepFraction(step: StepProgressLike): number {
  if (step.status === "Fait") return 1;
  const tasks = step.tasks ?? [];
  if (!tasks.length) return 0;
  return tasks.filter((t) => t.done).length / tasks.length;
}

export function overallProgress(steps: StepProgressLike[]): number {
  const counted = steps.filter((s) => s.status !== "Si nécessaire");
  if (!counted.length) return 0;
  return counted.reduce((sum, s) => sum + stepFraction(s), 0) / counted.length;
}

export function phaseAllDone(steps: Array<Pick<Step, "status">>): boolean {
  return steps.every((s) => !isOpenStep(s.status));
}

export function phaseProgress(steps: Array<StepProgressLike & { phase: string }>): Array<{ phase: string; pct: number }> {
  const order: string[] = [];
  const byPhase = new Map<string, StepProgressLike[]>();
  for (const s of steps) {
    if (!byPhase.has(s.phase)) {
      byPhase.set(s.phase, []);
      order.push(s.phase);
    }
    byPhase.get(s.phase)!.push(s);
  }
  return order.map((phase) => ({ phase, pct: Math.round(overallProgress(byPhase.get(phase)!) * 100) }));
}

/** Transitions automatiques déclenchées quand on coche/décoche une mini-étape. Ne touche jamais à Bloqué ni Si nécessaire. */
export function nextStatusAfterTaskToggle(
  status: StepStatus,
  doneCount: number,
  totalCount: number,
): StepStatus {
  if (totalCount > 0 && doneCount === totalCount && status !== "Fait") return "Fait";
  if (doneCount < totalCount && status === "Fait") return "En cours";
  if (doneCount > 0 && status === "À faire") return "En cours";
  return status;
}

/** Quand une étape passe à Fait automatiquement, le prototype remplit `actual` avec `planned` si `actual` est vide. */
export function autoFillActual(
  step: Pick<Step, "planned" | "actual">,
  newStatus: StepStatus,
): number | null {
  if (newStatus === "Fait" && step.planned != null && step.actual == null) return step.planned;
  return step.actual;
}

// ---------- trous d'historique / adresses ----------

interface GapRow {
  from: string;
  to: string;
  parallel?: boolean;
}

export function gapsOf<T extends GapRow>(
  rows: T[],
  startIso: string | null,
  labelOf: (row: T) => string,
  now: Date = new Date(),
): string[] {
  const out: string[] = [];
  const todayU = today0(now);
  const sorted = rows
    .filter((r) => !r.parallel)
    .slice()
    .sort((a, b) => {
      const da = pd(a.from)?.getTime() ?? Infinity;
      const db = pd(b.from)?.getTime() ?? Infinity;
      return da - db;
    });

  let cur = pd(startIso);
  for (const row of sorted) {
    const f = pd(row.from);
    const e = row.to ? pd(row.to, true) : todayU;
    if (!f) {
      out.push(`Date de début illisible : ${labelOf(row)}`);
      continue;
    }
    if (cur && (f.getTime() - cur.getTime()) / DAY_MS > 4) {
      out.push(`Trou du ${fmtD(cur)} au ${fmtD(new Date(f.getTime() - DAY_MS))}`);
    }
    if (e && (!cur || e.getTime() > cur.getTime())) {
      cur = new Date(e.getTime() + DAY_MS);
    }
  }
  if (cur && (todayU.getTime() - cur.getTime()) / DAY_MS > 4) {
    out.push(`Rien de déclaré depuis le ${fmtD(cur)}`);
  }
  return out;
}

export function historyGaps(
  history: Array<Pick<HistoryEntry, "from" | "to" | "parallel" | "activity">>,
  naissanceIso: string | null | undefined,
  now: Date = new Date(),
): string[] {
  return gapsOf(history, eighteenthBirthdayIso(naissanceIso), (r) => r.activity || "période", now);
}

export function addressGaps(
  addresses: Array<Pick<AddressEntry, "from" | "to" | "parallel" | "address">>,
  naissanceIso: string | null | undefined,
  now: Date = new Date(),
): string[] {
  return gapsOf(addresses, eighteenthBirthdayIso(naissanceIso), (r) => r.address || "adresse", now);
}

// ---------- expérience qualifiée ----------

export function workMonths(
  history: Array<Pick<HistoryEntry, "type" | "from" | "to">>,
  untilIso: string | null | undefined,
  now: Date = new Date(),
): number {
  const limit = (untilIso ? pd(untilIso) : null) ?? today0(now);
  let total = 0;
  for (const h of history) {
    if (h.type !== "Travail") continue;
    const f = pd(h.from);
    if (!f) continue;
    let e = h.to ? pd(h.to, true) : limit;
    if (!e) continue;
    if (e.getTime() > limit.getTime()) e = limit;
    if (e.getTime() > f.getTime()) total += (e.getTime() - f.getTime()) / (DAY_MS * MONTH_DAYS);
  }
  return total;
}

export function formatYearsMonths(totalMonths: number): string {
  const m = Math.floor(totalMonths);
  const y = Math.floor(m / 12);
  const rem = m % 12;
  if (y === 0) return `${rem} mois`;
  const yLabel = `${y} an${y === 1 ? "" : "s"}`;
  return rem === 0 ? yLabel : `${yLabel} ${rem} mois`;
}

// ---------- grille des travailleurs qualifiés (FSW) ----------

export const EDU_LEVELS: Array<{ code: string; label: string; points: number }> = [
  { code: "", label: "Choisir après l'évaluation WES", points: 0 },
  { code: "sec", label: "Diplôme d'études secondaires", points: 5 },
  { code: "p1", label: "Diplôme postsecondaire d'un an", points: 15 },
  { code: "p2", label: "Diplôme postsecondaire de deux ans", points: 19 },
  { code: "p3", label: "Diplôme de 3 ans ou plus, ou baccalauréat", points: 21 },
  { code: "p2c", label: "Deux diplômes ou plus, dont un de 3 ans ou plus", points: 22 },
  { code: "ma", label: "Maîtrise ou diplôme professionnel", points: 23 },
  { code: "phd", label: "Doctorat", points: 25 },
];

export const FSW_PASS_THRESHOLD = 67;

function languageTestPoints(level: number): number {
  if (level >= 9) return 6;
  if (level >= 8) return 5;
  if (level >= 7) return 4;
  return 0;
}

function otherLanguage(first: "fr" | "en"): "fr" | "en" {
  return first === "fr" ? "en" : "fr";
}

function firstLanguageScores(fsw: FswProfile): [number, number, number, number] {
  const p = fsw.first;
  return [Number(fsw[`${p}_co`] || 0), Number(fsw[`${p}_ce`] || 0), Number(fsw[`${p}_eo`] || 0), Number(fsw[`${p}_ee`] || 0)];
}

function secondLanguageScores(fsw: FswProfile): [number, number, number, number] {
  const s = otherLanguage(fsw.first);
  return [Number(fsw[`${s}_co`] || 0), Number(fsw[`${s}_ce`] || 0), Number(fsw[`${s}_eo`] || 0), Number(fsw[`${s}_ee`] || 0)];
}

function firstLanguageEntered(fsw: FswProfile): [string, string, string, string] {
  const p = fsw.first;
  return [fsw[`${p}_co`], fsw[`${p}_ce`], fsw[`${p}_eo`], fsw[`${p}_ee`]];
}

export function ageAt(
  naissanceIso: string | null | undefined,
  atIso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const b = pd(naissanceIso);
  if (!b) return null;
  const at = (atIso ? pd(atIso) : null) ?? today0(now);
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  if (
    at.getUTCMonth() < b.getUTCMonth() ||
    (at.getUTCMonth() === b.getUTCMonth() && at.getUTCDate() < b.getUTCDate())
  ) {
    age--;
  }
  return age;
}

function agePoints(age: number | null): number {
  if (age == null || age < 18) return 0;
  if (age <= 35) return 12;
  if (age >= 47) return 0;
  return 12 - (age - 35);
}

export interface FswResult {
  l1: number;
  l2: number;
  ed: number;
  ex: number;
  ag: number;
  ae: number;
  ad: number;
  total: number;
  below: boolean;
  known: boolean;
  eduSet: boolean;
  status: "Non admissible" | "À compléter" | "Admissible";
  margin: number; // total - seuil, négatif si sous le seuil
  simulation: Array<{ level: number; withSecond: boolean; total: number }>;
}

export function fswCalc(
  fsw: FswProfile,
  naissanceIso: string | null | undefined,
  profileDateIso: string | null | undefined,
  history: Array<Pick<HistoryEntry, "type" | "from" | "to">>,
  now: Date = new Date(),
): FswResult {
  const entered = firstLanguageEntered(fsw);
  const scores1 = firstLanguageScores(fsw);
  const scores2 = secondLanguageScores(fsw);

  const known = entered.every((v) => v !== "" && v != null);
  const below = entered.some((v) => v !== "" && v != null && Number(v) < 7);
  const l1 = scores1.reduce((sum, v) => sum + languageTestPoints(v), 0);
  const l2 = scores2.every((v) => v >= 5) ? 4 : 0;

  const eduSet = fsw.edu !== "" && fsw.edu != null;
  const ed = EDU_LEVELS.find((e) => e.code === fsw.edu)?.points ?? 0;

  const months = workMonths(history, profileDateIso, now);
  const years = Math.floor(months / 12);
  const ex = years >= 6 ? 15 : years >= 4 ? 13 : years >= 2 ? 11 : years >= 1 ? 9 : 0;

  const age = ageAt(naissanceIso, profileDateIso, now);
  const ag = agePoints(age);

  const ae = fsw.arranged === "10" ? 10 : 0;
  const ad = Math.min(10, Number(fsw.adapt || 0));

  const total = l1 + l2 + ed + ex + ag + ae + ad;

  let status: FswResult["status"];
  if (below) status = "Non admissible";
  else if (!known || !eduSet) status = "À compléter";
  else if (total >= FSW_PASS_THRESHOLD) status = "Admissible";
  else status = "Non admissible";

  const edB = eduSet ? ed : 19; // hypothèse par défaut de la simulation : "postsecondaire deux ans"
  const simulation = [7, 8, 9].flatMap((level) =>
    [false, true].map((withSecond) => {
      const l1sim = languageTestPoints(level) * 4;
      const l2sim = withSecond ? 4 : 0;
      return { level, withSecond, total: l1sim + l2sim + edB + ex + ag + ae + ad };
    }),
  );

  return { l1, l2, ed, ex, ag, ae, ad, total, below, known, eduSet, status, margin: total - FSW_PASS_THRESHOLD, simulation };
}

// ---------- contrôle du dossier (audit) ----------

export type AuditLevel = "hi" | "md" | "lo";

export const AUDIT_LEVEL_LABEL: Record<AuditLevel, string> = {
  hi: "Bloquant",
  md: "À traiter",
  lo: "À compléter",
};

export interface AuditItem {
  level: AuditLevel;
  text: string;
  goto: "parcours" | "profil" | "documents" | "epargne";
  targetId?: string;
  due?: boolean;
}

export interface AuditInput {
  steps: Array<Pick<Step, "id" | "title" | "status" | "due">>;
  documents: Array<Pick<DocumentRecord, "id" | "status" | "checks" | "files"> & { name?: string; expires?: string | null }>;
  gaps: Array<{ id: string; text: string; done: boolean }>;
  identity: Partial<Record<"nom" | "prenoms" | "naissance" | "lieu" | "pere" | "mere", string | null>>;
  profile: Partial<Record<"passeport" | "telephone" | "courriel", string | null>>;
  history: Array<Pick<HistoryEntry, "from" | "to" | "parallel" | "activity" | "org" | "place">>;
  addresses: Array<Pick<AddressEntry, "from" | "to" | "parallel" | "address">>;
  savings: Array<Pick<Saving, "actual">>;
  fsw: FswResult;
}

const IDENTITY_FIELDS: Array<["nom" | "prenoms" | "naissance" | "lieu" | "pere" | "mere", string]> = [
  ["nom", "Nom"],
  ["prenoms", "Prénoms"],
  ["naissance", "Date de naissance"],
  ["lieu", "Lieu de naissance"],
  ["pere", "Père"],
  ["mere", "Mère"],
];

const PROFILE_FIELDS: Array<["passeport" | "telephone" | "courriel", string]> = [
  ["passeport", "Numéro de passeport"],
  ["telephone", "Téléphone"],
  ["courriel", "Courriel"],
];

const TO_COMPLETE_RE = /à compléter|à préciser/i;

const LEVEL_RANK: Record<AuditLevel, number> = { hi: 0, md: 1, lo: 2 };

export function audit(input: AuditInput, now: Date = new Date()): AuditItem[] {
  const out: AuditItem[] = [];

  for (const s of input.steps) {
    if (isLate(s, now)) out.push({ level: "hi", text: `Étape en retard : ${s.title}`, goto: "parcours", targetId: s.id });
  }
  for (const s of input.steps) {
    if (!isOpenStep(s.status)) continue;
    const d = daysUntil(s.due, now);
    if (d !== null && d >= 0 && d <= 7) {
      out.push({ level: "md", text: `Échéance dans ${d} jour${d === 1 ? "" : "s"} : ${s.title}`, goto: "parcours", targetId: s.id, due: true });
    }
  }

  for (const g of historyGaps(input.history, input.identity.naissance, now)) {
    out.push({ level: "hi", text: g, goto: "profil" });
  }
  for (const g of addressGaps(input.addresses, input.identity.naissance, now)) {
    out.push({ level: "hi", text: g, goto: "profil" });
  }

  for (const g of input.gaps) {
    if (!g.done) out.push({ level: "md", text: g.text, goto: "documents" });
  }

  for (const [field, label] of IDENTITY_FIELDS) {
    if (!input.identity[field]) out.push({ level: "md", text: `Champ d'identité manquant : ${label}`, goto: "documents" });
  }

  for (const d of input.documents) {
    if (d.status === "Obtenu" && d.checks.some((c) => !c.done)) {
      out.push({ level: "md", text: "Document obtenu avec des contrôles incomplets", goto: "documents", targetId: d.id });
    }
  }
  for (const d of input.documents) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.expires ?? "");
    if (!m) continue;
    const days = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
    const name = d.name ? ` : ${d.name}` : "";
    if (days < 0) out.push({ level: "hi", text: `Pièce expirée${name}`, goto: "documents", targetId: d.id });
    else if (days <= 30) out.push({ level: "md", text: `Pièce qui expire dans ${days} jour${days > 1 ? "s" : ""}${name}`, goto: "documents", targetId: d.id });
  }
  for (const d of input.documents) {
    if (d.status === "Obtenu" && d.files.length === 0) {
      out.push({ level: "lo", text: "Document obtenu sans scan déposé", goto: "documents", targetId: d.id });
    }
  }

  for (const h of input.history) {
    const blob = `${h.org} ${h.activity} ${h.place}`;
    if (TO_COMPLETE_RE.test(blob)) out.push({ level: "lo", text: `Ligne d'historique à préciser : ${h.activity || h.org}`, goto: "profil" });
  }

  if (input.fsw.below) out.push({ level: "hi", text: "Grille des travailleurs qualifiés : une épreuve de 1re langue est sous le niveau 7", goto: "profil" });
  else if (input.fsw.known && input.fsw.eduSet && input.fsw.total < FSW_PASS_THRESHOLD) {
    out.push({ level: "hi", text: `Grille des travailleurs qualifiés sous le seuil (${input.fsw.total}/${FSW_PASS_THRESHOLD})`, goto: "profil" });
  }

  if (input.savings.reduce((sum, s) => sum + (s.actual ?? 0), 0) === 0) {
    out.push({ level: "md", text: "Aucun montant réel saisi dans l'épargne", goto: "epargne" });
  }

  for (const [field, label] of PROFILE_FIELDS) {
    if (!input.profile[field]) out.push({ level: "lo", text: `Champ de profil vide : ${label}`, goto: "profil" });
  }

  return out
    .map((item, index) => ({ item, index }))
    .sort((a, b) => LEVEL_RANK[a.item.level] - LEVEL_RANK[b.item.level] || a.index - b.index)
    .map(({ item }) => item);
}

export function nextOpenStep<T extends Pick<Step, "status" | "due">>(steps: T[], now: Date = new Date()): T | null {
  const open = steps.filter((s) => isOpenStep(s.status));
  if (!open.length) return null;
  return open.reduce((best, s) => {
    const bd = daysUntil(best.due, now);
    const sd = daysUntil(s.due, now);
    if (sd === null) return best;
    if (bd === null) return s;
    return sd < bd ? s : best;
  }, open[0]);
}

// ---------- budget ----------

export function budgetByPhase(
  steps: Array<Pick<Step, "phase" | "planned" | "actual">>,
): Array<{ phase: string; planned: number; actual: number }> {
  const order: string[] = [];
  const totals = new Map<string, { planned: number; actual: number }>();
  for (const s of steps) {
    if (!totals.has(s.phase)) {
      totals.set(s.phase, { planned: 0, actual: 0 });
      order.push(s.phase);
    }
    const row = totals.get(s.phase)!;
    row.planned += s.planned ?? 0;
    row.actual += s.actual ?? 0;
  }
  return order.map((phase) => ({ phase, ...totals.get(phase)! }));
}

// ---------- épargne / fonds ----------

export function fundsSaved(savings: Array<Pick<Saving, "actual">>): number {
  return savings.reduce((sum, s) => sum + (s.actual ?? 0), 0);
}

export interface FundsProgress {
  saved: number;
  pctOfTarget: number;
  minMarkPct: number;
  minReached: boolean;
  targetReached: boolean;
}

export function fundsProgress(savings: Array<Pick<Saving, "actual">>, dossier: Pick<Dossier, "fundsMin" | "fundsTarget">): FundsProgress {
  const saved = fundsSaved(savings);
  const pctOfTarget = dossier.fundsTarget > 0 ? Math.min(100, (saved / dossier.fundsTarget) * 100) : 0;
  const minMarkPct = dossier.fundsTarget > 0 ? Math.min(100, (dossier.fundsMin / dossier.fundsTarget) * 100) : 0;
  return { saved, pctOfTarget, minMarkPct, minReached: saved >= dossier.fundsMin, targetReached: saved >= dossier.fundsTarget };
}

// ---------- liens ----------

const HTTPS_RE = /^https:\/\/[^\s"'<>]+$/i;

export function safeUrl(u: string | null | undefined): string | null {
  const trimmed = String(u ?? "").trim();
  if (!HTTPS_RE.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ---------- contacts (pas de logique dédiée, exporté pour cohérence) ----------

export function nextContactAction(contacts: Array<Pick<Contact, "next">>): string[] {
  return contacts.map((c) => c.next).filter(Boolean);
}
