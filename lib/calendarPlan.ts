/**
 * Événements du calendrier : formation, envois, étapes du Parcours, expirations de pièces.
 * Aucune entrée/sortie : le contenu est calculé ici, l'envoi à Google se fait dans lib/calendar.ts.
 */
import {
  ALL_WEEKS,
  DATED_SEND_KEYS,
  addDays,
  dayPlan,
  programDays,
  sendKey,
  type DayItem,
} from "./formation";

export interface CalEvent {
  key: string;
  date: string;
  /** Minutes depuis minuit ; null : toute la journée. */
  start: number | null;
  minutes: number;
  title: string;
  description: string;
}

export interface CalStep {
  id: string;
  title: string;
  due: string | null;
  status: string;
  tasks: Array<{ text: string; done: boolean }>;
}

/** Créneaux du programme sans heure fixe : heure de début (les tâches d'un même créneau se suivent). */
export const SLOT_START: Record<string, string> = {
  "Trajet aller": "06:00",
  Trajets: "06:00",
  "Pause déjeuner": "12:30",
  "Après-midi": "16:30",
  "Trajet retour": "17:30",
  Soir: "20:30",
};
/** Les jours passés plus anciens ne sont plus modifiés dans le calendrier. */
export const KEEP_DAYS = 7;

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const check = (done: boolean) => (done ? "✓ " : "");

function formationDay(
  iso: string,
  items: DayItem[],
  done: Set<string>,
  base: string,
): CalEvent[] {
  const cursor = new Map<string, number>();
  return items.map((it) => {
    let start = toMin(it.time);
    const minutes = it.minutes ?? 30;
    if (start === null && SLOT_START[it.time]) {
      start = cursor.get(it.time) ?? toMin(SLOT_START[it.time])!;
      cursor.set(it.time, start + minutes);
    }
    const isDone = done.has(it.key);
    return {
      key: `f:${it.key}`,
      date: iso,
      start,
      minutes,
      title: `${check(isDone)}${it.lang ? `${it.lang.toUpperCase()} · ` : ""}${it.label}`,
      description: [it.detail, `${base}/formation?d=${iso}`]
        .filter(Boolean)
        .join("\n"),
    };
  });
}

export function buildEvents(input: {
  today: string;
  done: Set<string>;
  steps: CalStep[];
  docs: Array<{ id: string; name: string; expires: string | null }>;
  base: string;
}): CalEvent[] {
  const { today, done, base } = input;
  const from = addDays(today, -KEEP_DAYS);
  const out: CalEvent[] = [];
  const allDay = (
    key: string,
    date: string,
    title: string,
    description: string,
  ) => out.push({ key, date, start: null, minutes: 0, title, description });

  for (const d of programDays()) {
    if (d < from) continue;
    const plan = dayPlan(d);
    if (plan) out.push(...formationDay(d, plan.items, done, base));
  }
  // Envois de la semaine sans date propre : au dernier jour de la semaine.
  for (const w of ALL_WEEKS) {
    if (w.to < from) continue;
    w.sends.forEach((s, i) => {
      const k = sendKey(w, i);
      if (DATED_SEND_KEYS.has(k)) return;
      allDay(
        `f:${k}`,
        w.to,
        `${check(done.has(k))}À envoyer cette semaine : ${s.label}`,
        [s.subject, `${base}/formation?d=${w.to}`].filter(Boolean).join("\n"),
      );
    });
  }
  for (const s of input.steps) {
    if (!s.due || s.due < from || s.status === "Si nécessaire") continue;
    allDay(
      `s:${s.id}`,
      s.due,
      `${check(s.status === "Fait")}Échéance : ${s.title}`,
      [
        ...s.tasks.map((t) => `${t.done ? "☑" : "☐"} ${t.text}`),
        `${base}/parcours`,
      ].join("\n"),
    );
  }
  for (const d of input.docs) {
    if (!d.expires || !/^\d{4}-\d{2}-\d{2}$/.test(d.expires)) continue;
    if (d.expires < from) continue;
    allDay(
      `d:${d.id}`,
      d.expires,
      `Expire : ${d.name}`,
      `${base}/documents`,
    );
  }
  return out;
}

/** Corps d'un événement pour l'API Google Calendar. */
export function googleBody(e: CalEvent) {
  const at = (min: number) => {
    const day = addDays(e.date, Math.floor(min / 1440));
    const m = min % 1440;
    return `${day}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
  };
  const tz = "Africa/Abidjan";
  return {
    status: "confirmed",
    summary: e.title.slice(0, 250),
    description: e.description,
    start:
      e.start === null
        ? { date: e.date }
        : { dateTime: at(e.start), timeZone: tz },
    end:
      e.start === null
        ? { date: addDays(e.date, 1) }
        : { dateTime: at(e.start + e.minutes), timeZone: tz },
    transparency: e.start === null ? "transparent" : "opaque",
    // Les rappels viennent déjà de l'application.
    reminders: { useDefault: false },
  };
}

/**
 * Différences avec ce qui a déjà été envoyé (clé → « date|empreinte »). Un événement passé depuis plus
 * d'une semaine est simplement oublié : il reste dans le calendrier comme trace.
 */
export function diffEvents(
  events: CalEvent[],
  sent: Record<string, string>,
  today: string,
  hash: (e: CalEvent) => string,
): { save: CalEvent[]; remove: string[]; forget: string[] } {
  const from = addDays(today, -KEEP_DAYS);
  const keys = new Set(events.map((e) => e.key));
  const gone = Object.keys(sent).filter((k) => !keys.has(k));
  const old = (k: string) => sent[k].slice(0, 10) < from;
  return {
    save: events
      .filter((e) => sent[e.key] !== `${e.date}|${hash(e)}`)
      .sort((a, b) => {
        // Le plus proche d'abord : une première synchronisation interrompue sert déjà.
        const pa = a.date < today ? 1 : 0;
        const pb = b.date < today ? 1 : 0;
        return pa - pb || a.date.localeCompare(b.date);
      }),
    remove: gone.filter((k) => !old(k)),
    forget: gone.filter(old),
  };
}
