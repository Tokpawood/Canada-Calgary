import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DriveError, requireDrive } from "@/lib/drive";
import { buildEvents, diffEvents, googleBody, type CalEvent } from "@/lib/calendarPlan";
import { abidjanNow } from "@/lib/notifyPlan";

/** Envoi vers Google Calendar (sens unique). L'application ne voit que le calendrier qu'elle a créé. */
const API = "https://www.googleapis.com/calendar/v3/calendars";
const NAME = "Projet Canada Calgary";
/** Un envoi interrompu libère sa place au bout de ce délai. */
const LOCK_MS = 6 * 60_000;
/** Après une erreur, l'envoi automatique attend avant de réessayer. */
const RETRY_MS = 30 * 60_000;

export interface CalendarStatus {
  enabled: boolean;
  lastSync: string | null;
  lastError: string | null;
  count: number;
  pending: number;
}

export async function calendarStatus(dossierId: string): Promise<CalendarStatus> {
  const { data } = await createAdminClient().from("calendar_sync").select("enabled,last_sync,last_error,sent,pending").eq("dossier_id", dossierId).maybeSingle();
  return {
    enabled: Boolean(data?.enabled),
    lastSync: (data?.last_sync as string | null) ?? null,
    lastError: (data?.last_error as string | null) ?? null,
    count: Object.keys((data?.sent as Record<string, string> | undefined) ?? {}).length,
    pending: Number(data?.pending ?? 0),
  };
}

export async function setCalendarEnabled(dossierId: string, enabled: boolean): Promise<void> {
  const { error } = await createAdminClient()
    .from("calendar_sync")
    .upsert({ dossier_id: dossierId, enabled, last_error: null }, { onConflict: "dossier_id" });
  if (error) throw new DriveError(error.message, 500);
}

const eventHash = (e: CalEvent) => createHash("sha256").update(JSON.stringify(googleBody(e))).digest("hex").slice(0, 16);
/** Identifiant stable (lettres a-v et chiffres seulement) : renvoyer le même événement ne le double pas. */
const eventId = (dossierId: string, key: string) => `pcc${createHash("sha256").update(`${dossierId}:${key}`).digest("hex").slice(0, 40)}`;

async function call(token: string, method: string, url: string, body?: unknown): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    if (!res) throw new DriveError("Google Calendar est injoignable.", 503);
    if (res.ok || [404, 409, 410].includes(res.status)) return res;
    const text = await res.text();
    const limited = res.status === 429 || (res.status === 403 && /rateLimitExceeded|RATE_LIMIT|quotaExceeded/i.test(text));
    if ((limited || res.status >= 500) && i < 4) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      continue;
    }
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(text)) throw new DriveError("L'API Google Calendar n'est pas activée dans Google Cloud.", 409);
    if (res.status === 401 || (res.status === 403 && /insufficient/i.test(text)))
      throw new DriveError("L'accès au calendrier n'a pas été autorisé : touchez « Connecter le calendrier » et cochez l'autorisation.", 409);
    console.error("[calendrier]", method, res.status, text.slice(0, 300));
    throw new DriveError(`Google Calendar a refusé la demande (code ${res.status}).`, 502);
  }
}

async function ensureCalendar(token: string, id: string | null): Promise<{ id: string; fresh: boolean }> {
  if (id) {
    const res = await call(token, "GET", `${API}/${encodeURIComponent(id)}`);
    if (res.ok) return { id, fresh: false };
  }
  const res = await call(token, "POST", API, { summary: NAME, description: "Formation et démarches, envoyées par l'application. Les modifications faites ici ne reviennent pas dans l'application.", timeZone: "Africa/Abidjan" });
  const json = (await res.json()) as { id?: string };
  if (!res.ok || !json.id) throw new DriveError("Impossible de créer le calendrier.");
  return { id: json.id, fresh: true };
}

async function save(token: string, cal: string, id: string, e: CalEvent, known: boolean) {
  const url = `${API}/${encodeURIComponent(cal)}/events`;
  const body = googleBody(e);
  const put = () => call(token, "PUT", `${url}/${id}`, body);
  const post = () => call(token, "POST", url, { id, ...body });
  // Le plus probable d'abord ; l'autre si l'événement manque, ou existe déjà (envoi interrompu).
  const res = await (known ? put() : post());
  if (res.ok) return;
  const second = await (known ? post() : put());
  if (!second.ok) throw new DriveError(`Événement refusé par Google Calendar (code ${second.status}).`);
}

/** Met le calendrier à jour. `auto` : appel périodique, silencieux quand rien n'est à faire. */
export async function syncCalendar(dossierId: string, opts: { auto?: boolean; budgetMs?: number } = {}): Promise<{ saved: number; removed: number; pending: number }> {
  const none = { saved: 0, removed: 0, pending: 0 };
  const admin = createAdminClient();
  const { data: row } = await admin.from("calendar_sync").select("*").eq("dossier_id", dossierId).maybeSingle();
  if (!row?.enabled) return none;
  const now = Date.now();
  if (opts.auto && row.last_error && row.locked_at && now - Date.parse(row.locked_at as string) < RETRY_MS) return none;

  const { date: today } = abidjanNow();
  const [checks, steps, docs] = await Promise.all([loadChecks(dossierId), loadSteps(dossierId), admin.from("document").select("id,name,expires").eq("dossier_id", dossierId).not("expires", "is", null)]);
  if (docs.error) throw new DriveError(docs.error.message, 500);
  const base = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "canada-calgary.vercel.app"}`;
  const events = buildEvents({ today, done: checks, steps, docs: (docs.data ?? []) as Array<{ id: string; name: string; expires: string | null }>, base });
  let sent = { ...((row.sent as Record<string, string>) ?? {}) };
  const first = diffEvents(events, sent, today, eventHash);
  if (opts.auto && !first.save.length && !first.remove.length) return none;

  // Un seul envoi à la fois.
  const limit = new Date(now - LOCK_MS).toISOString();
  const { data: won } = await admin
    .from("calendar_sync")
    .update({ locked_at: new Date(now).toISOString(), running: true })
    .eq("dossier_id", dossierId)
    .or(`running.eq.false,locked_at.lt.${limit}`)
    .select("dossier_id");
  if (!won?.length) {
    if (opts.auto) return none;
    throw new DriveError("Une synchronisation est déjà en cours.", 409);
  }

  let saved = 0;
  let removed = 0;
  let pending = 0;
  let error: string | null = null;
  let calId = (row.calendar_id as string | null) ?? null;
  try {
    const { token } = await requireDrive(dossierId);
    const cal = await ensureCalendar(token, calId);
    calId = cal.id;
    if (cal.fresh) {
      sent = {};
      await admin.from("calendar_sync").update({ calendar_id: calId, sent }).eq("dossier_id", dossierId);
    }
    const d = diffEvents(events, sent, today, eventHash);
    d.forget.forEach((k) => delete sent[k]);
    const jobs: Array<() => Promise<void>> = [
      ...d.remove.map((k) => async () => {
        await call(token, "DELETE", `${API}/${encodeURIComponent(cal.id)}/events/${eventId(dossierId, k)}`);
        delete sent[k];
        removed++;
      }),
      ...d.save.map((e) => async () => {
        await save(token, cal.id, eventId(dossierId, e.key), e, e.key in sent);
        sent[e.key] = `${e.date}|${eventHash(e)}`;
        saved++;
      }),
    ];
    const until = now + (opts.budgetMs ?? 200_000);
    let i = 0;
    let failed: unknown = null;
    const worker = async () => {
      while (i < jobs.length && Date.now() < until && !failed) {
        try {
          await jobs[i++]();
        } catch (e) {
          failed = e;
        }
      }
    };
    // Deux à la fois, pour rester sous la limite de Google par minute.
    await Promise.all([worker(), worker()]);
    pending = jobs.length - saved - removed;
    if (failed) throw failed;
  } catch (e) {
    error = e instanceof DriveError ? e.message : "La synchronisation a échoué.";
    if (!(e instanceof DriveError)) console.error("[calendrier]", e);
  }
  await admin
    .from("calendar_sync")
    .update({ calendar_id: calId, sent, pending, running: false, last_error: error, ...(error ? {} : { last_sync: new Date().toISOString() }) })
    .eq("dossier_id", dossierId);
  if (error && !opts.auto) throw new DriveError(error, 502);
  return { saved, removed, pending };
}

/** Tous les dossiers dont le calendrier est activé (appel périodique). */
export async function syncAllCalendars(): Promise<void> {
  const { data } = await createAdminClient().from("calendar_sync").select("dossier_id").eq("enabled", true);
  for (const r of data ?? []) {
    try {
      await syncCalendar(r.dossier_id as string, { auto: true });
    } catch (e) {
      console.error("[calendrier]", e instanceof Error ? e.message : e);
    }
  }
}

async function loadChecks(dossierId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const admin = createAdminClient();
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await admin.from("training_check").select("item_key").eq("dossier_id", dossierId).order("item_key").range(from, from + 999);
    if (error) throw new DriveError(error.message, 500);
    for (const r of data ?? []) out.add(r.item_key as string);
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

async function loadSteps(dossierId: string) {
  const { data, error } = await createAdminClient().from("step").select("id,title,due,status,step_task(text,done,position)").eq("dossier_id", dossierId);
  if (error) throw new DriveError(error.message, 500);
  return (data ?? []).map((s) => ({
    id: s.id as string,
    title: s.title as string,
    due: s.due as string | null,
    status: s.status as string,
    tasks: [...((s.step_task as Array<{ text: string; done: boolean; position: number }>) ?? [])].sort((a, b) => a.position - b.position),
  }));
}
