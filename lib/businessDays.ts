/**
 * Jours ouvrables (Côte d'Ivoire) : du lundi au vendredi, hors jours fériés à date fixe
 * et fériés chrétiens calculés depuis Pâques. Les fêtes musulmanes (Tabaski, Ramadan, Maouloud)
 * dépendent de l'observation de la lune : elles ne sont pas comptées, à vérifier au cas par cas.
 */

const FIXED = ["01-01", "05-01", "08-07", "08-15", "11-01", "11-15", "12-25"];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function utc(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const cache = new Map<number, Set<string>>();
export function publicHolidays(year: number): Set<string> {
  let set = cache.get(year);
  if (!set) {
    const easter = utc(easterSunday(year));
    set = new Set([
      ...FIXED.map((md) => `${year}-${md}`),
      iso(addUtcDays(easter, 1)), // lundi de Pâques
      iso(addUtcDays(easter, 39)), // Ascension
      iso(addUtcDays(easter, 50)), // lundi de Pentecôte
    ]);
    cache.set(year, set);
  }
  return set;
}

export function isBusinessDay(isoDate: string): boolean {
  const d = utc(isoDate);
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !publicHolidays(d.getUTCFullYear()).has(isoDate);
}

/**
 * Date atteinte après `n` jours ouvrables « à compter du » jour donné : le décompte
 * commence le lendemain (le jour de départ ne compte pas).
 */
export function addBusinessDays(startIso: string, n: number): string {
  let d = utc(startIso);
  let left = Math.max(0, Math.floor(n));
  while (left > 0) {
    d = addUtcDays(d, 1);
    if (isBusinessDay(iso(d))) left -= 1;
  }
  return iso(d);
}
