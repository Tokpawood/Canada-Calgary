/**
 * Rappels push de la formation : à quels moments de la journée envoyer quoi.
 * Logique pure (sans réseau) : la route du planificateur s'en sert, les tests aussi.
 * Les horaires sont en heure d'Abidjan (UTC+0 toute l'année).
 */
import { dayPlan, type DayItem } from "./formation";

export type MomentId = "resume" | "matin" | "aller" | "midi" | "retour" | "jour" | "aprem" | "soir" | "carnet" | "bilan";

export interface MomentDef {
  id: MomentId;
  label: string;
  time: string;
  hint: string;
}

export const MOMENTS: MomentDef[] = [
  { id: "resume", label: "Programme du jour", time: "05:00", hint: "Résumé des tâches et des étapes du parcours" },
  { id: "matin", label: "Séance du matin", time: "05:15", hint: "Expression écrite ou Writing" },
  { id: "aller", label: "Trajet aller", time: "06:00", hint: "Écoute, podcast, Anki" },
  { id: "midi", label: "Pause déjeuner", time: "12:30", hint: "Compréhension écrite ou Reading" },
  { id: "retour", label: "Trajet retour", time: "17:30", hint: "Podcast et anglais" },
  { id: "jour", label: "Week-end : matinée", time: "07:00", hint: "Examens blancs, jalons, jours sans horaire" },
  { id: "aprem", label: "Week-end : après-midi", time: "15:00", hint: "Tâches « Après-midi »" },
  { id: "soir", label: "Séance du soir", time: "20:30", hint: "Expression orale ou Speaking" },
  { id: "carnet", label: "Carnet d'erreurs", time: "21:15", hint: "Fin de journée" },
  { id: "bilan", label: "Bilan du soir", time: "21:45", hint: "Seulement s'il reste des tâches non validées" },
];

export type NotifyTimes = Partial<Record<MomentId, string>>;

export interface NotifySettings {
  enabled: boolean;
  times: NotifyTimes;
  includeSteps: boolean;
}

export const DEFAULT_SETTINGS: NotifySettings = { enabled: true, times: {}, includeSteps: true };

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ne garde que les horaires valides des moments connus. */
export function cleanTimes(raw: unknown): NotifyTimes {
  const out: NotifyTimes = {};
  if (!raw || typeof raw !== "object") return out;
  for (const m of MOMENTS) {
    const v = (raw as Record<string, unknown>)[m.id];
    if (typeof v === "string" && HHMM.test(v)) out[m.id] = v;
  }
  return out;
}

export function momentTime(id: MomentId, times: NotifyTimes): string {
  return times[id] ?? MOMENTS.find((m) => m.id === id)!.time;
}

/**
 * Moment d'une tâche et, pour les tâches du week-end à horaire précis, l'heure exacte
 * (ces horaires viennent du programme et ne sont pas réglables).
 */
export function momentOf(item: DayItem): { id: MomentId | `h${string}`; fixed?: string } {
  const slot = item.key.slice(item.key.indexOf(":") + 1);
  switch (item.time) {
    case "Trajet aller":
    case "Trajets":
      return { id: "aller" };
    case "Pause déjeuner":
      return { id: "midi" };
    case "Trajet retour":
      return { id: "retour" };
    case "Journée":
    case "À faire":
    case "Matin":
      return { id: "jour" };
    case "Après-midi":
      return { id: "aprem" };
    case "Soir":
      return { id: "soir" };
  }
  if (item.group === "matin") return { id: "matin" };
  if (slot === "pm") return { id: "soir" };
  if (slot === "fin") return { id: "carnet" };
  if (HHMM.test(item.time)) return { id: `h${item.time}`, fixed: item.time };
  return { id: "jour" };
}

export interface StepLite {
  title: string;
  due: string | null;
  open: boolean;
}

export interface Reminder {
  /** Clé de dédoublonnage : « AAAA-MM-JJ:moment ». */
  key: string;
  at: string;
  title: string;
  body: string;
  url: string;
  /** Les notifications de même tag se remplacent sur l'appareil. */
  tag: string;
}

const taskUrl = (date: string, key?: string) => `/formation?d=${date}${key ? `&t=${encodeURIComponent(key)}` : ""}#jour`;

function list(items: DayItem[], max = 3): string {
  const shown = items.slice(0, max).map((i) => `• ${i.label}`);
  if (items.length > max) shown.push(`• et ${items.length - max} autre${items.length - max > 1 ? "s" : ""}`);
  return shown.join("\n");
}

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

/** Tous les rappels d'une journée, déjà filtrés : rien pour un moment dont les tâches sont faites. */
/** Jours avant la fin de validité où la notification du matin rappelle la pièce (pas chaque jour, pour ne pas lasser). */
export const EXPIRY_NOTICE_DAYS = [30, 7, 1, 0];

export interface DocLite {
  name: string;
  expires: string | null;
}

function daysBetween(fromIso: string, toIso: string): number {
  const [a, b] = [fromIso, toIso].map((x) => {
    const [y, m, d] = x.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

export function remindersFor(date: string, done: Set<string>, settings: NotifySettings, steps: StepLite[] = [], docs: DocLite[] = []): Reminder[] {
  if (!settings.enabled) return [];
  const plan = dayPlan(date);
  const items = plan?.items ?? [];
  const todo = items.filter((i) => !done.has(i.key));
  const out: Reminder[] = [];
  const t = (id: MomentId) => momentTime(id, settings.times);

  // Résumé du matin.
  const late = settings.includeSteps ? steps.filter((s) => s.open && s.due && s.due < date) : [];
  const dueToday = settings.includeSteps ? steps.filter((s) => s.open && s.due === date) : [];
  const parts: string[] = [];
  if (todo.length) parts.push(`${plural(todo.length, "tâche")} de formation · ${plan?.title ?? ""}`.trim());
  if (dueToday.length) parts.push(`Parcours, échéance aujourd'hui : ${dueToday.map((s) => s.title).slice(0, 2).join(", ")}${dueToday.length > 2 ? "…" : ""}`);
  if (late.length) parts.push(`Parcours : ${plural(late.length, "étape")} en retard`);
  const expiring = settings.includeSteps
    ? docs.filter((d) => d.expires && /^\d{4}-\d{2}-\d{2}$/.test(d.expires) && EXPIRY_NOTICE_DAYS.includes(daysBetween(date, d.expires)))
    : [];
  for (const d of expiring.slice(0, 2)) {
    const n = daysBetween(date, d.expires!);
    parts.push(`Pièce « ${d.name} » : ${n === 0 ? "expire aujourd'hui" : `expire dans ${plural(n, "jour")}`}`);
  }
  if (parts.length) {
    out.push({
      key: `${date}:resume`,
      at: t("resume"),
      title: "Votre programme du jour",
      body: parts.join("\n"),
      url: todo.length ? taskUrl(date, todo[0].key) : dueToday.length || late.length || !expiring.length ? "/parcours" : "/documents#controles",
      tag: `resume-${date}`,
    });
  }

  // Un rappel par moment, avec les tâches restantes de ce moment.
  const byMoment = new Map<string, { at: string; label: string; items: DayItem[] }>();
  for (const it of items) {
    const m = momentOf(it);
    const at = m.fixed ?? t(m.id as MomentId);
    const label = m.fixed ? `À ${m.fixed}` : MOMENTS.find((x) => x.id === m.id)!.label;
    const g = byMoment.get(m.id) ?? { at, label, items: [] };
    g.items.push(it);
    byMoment.set(m.id, g);
  }
  for (const [id, g] of byMoment) {
    const left = g.items.filter((i) => !done.has(i.key));
    if (!left.length) continue;
    const mins = left.reduce((s, i) => s + (i.minutes ?? 0), 0);
    out.push({
      key: `${date}:${id}`,
      at: g.at,
      title: `${g.label}${mins ? ` · ${mins} min` : ""}`,
      body: list(left),
      url: taskUrl(date, left[0].key),
      tag: `task-${date}-${id}`,
    });
  }

  // Bilan du soir : seulement s'il reste quelque chose.
  if (todo.length) {
    out.push({
      key: `${date}:bilan`,
      at: t("bilan"),
      title: `${plural(todo.length, "tâche")} à valider`,
      body: `Validez ce qui a été fait aujourd'hui.\n${list(todo)}`,
      url: taskUrl(date, todo[0].key),
      tag: `bilan-${date}`,
    });
  }

  return out.sort((a, b) => a.at.localeCompare(b.at));
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Rappels à envoyer maintenant : heure atteinte depuis moins de `windowMin` minutes. */
export function dueNow(reminders: Reminder[], nowHHMM: string, windowMin = 30): Reminder[] {
  const now = toMin(nowHHMM);
  return reminders.filter((r) => {
    const d = now - toMin(r.at);
    return d >= 0 && d < windowMin;
  });
}

/** Date et heure à Abidjan. */
export function abidjanNow(d: Date = new Date()): { date: string; time: string } {
  const date = d.toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Africa/Abidjan", hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}
