import type { SupabaseClient } from "@supabase/supabase-js";
import type { AddressEntry, Dossier, HistoryEntry, Saving, Step, SubTask, Link as StepLink } from "./types";

function mapDossier(row: Record<string, unknown>): Dossier {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    profileDate: (row.profile_date as string | null) ?? null,
    fundsMin: Number(row.funds_min ?? 0),
    fundsTarget: Number(row.funds_target ?? 0),
    cadRate: Number(row.cad_rate ?? 410),
  };
}

export async function getDossierForUser(supabase: SupabaseClient): Promise<Dossier | null> {
  const { data } = await supabase.from("dossier").select("*").maybeSingle();
  return data ? mapDossier(data) : null;
}

export async function getSavingsActual(supabase: SupabaseClient, dossierId: string): Promise<Array<Pick<Saving, "actual">>> {
  const { data } = await supabase.from("saving").select("actual").eq("dossier_id", dossierId);
  return data ?? [];
}

export async function getStepsWithDetails(supabase: SupabaseClient, dossierId: string): Promise<Step[]> {
  const { data: steps } = await supabase.from("step").select("*").eq("dossier_id", dossierId).order("position");
  const ids = (steps ?? []).map((s) => s.id as string);

  const [{ data: tasks }, { data: links }] = await Promise.all([
    ids.length
      ? supabase.from("step_task").select("id,step_id,text,done,position").in("step_id", ids).order("position")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabase.from("step_link").select("id,step_id,label,url,position").in("step_id", ids).order("position")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const tasksByStep = groupBy(tasks ?? [], (t) => t.step_id as string);
  const linksByStep = groupBy(links ?? [], (l) => l.step_id as string);

  return (steps ?? []).map((s) => mapStep(s, tasksByStep.get(s.id as string) ?? [], linksByStep.get(s.id as string) ?? []));
}

function mapStep(row: Record<string, unknown>, tasks: Record<string, unknown>[], links: Record<string, unknown>[]): Step {
  return {
    id: row.id as string,
    dossierId: row.dossier_id as string,
    phase: row.phase as string,
    title: row.title as string,
    due: (row.due as string | null) ?? null,
    status: row.status as Step["status"],
    planned: row.planned == null ? null : Number(row.planned),
    actual: row.actual == null ? null : Number(row.actual),
    org: (row.org as string) ?? "",
    req: (row.req as string) ?? "",
    notes: (row.notes as string) ?? "",
    risk: (row.risk as string) ?? "",
    position: Number(row.position ?? 0),
    tasks: tasks.map(mapSubTask),
    links: links.map(mapLink),
  };
}

function mapSubTask(row: Record<string, unknown>): SubTask {
  return { id: row.id as string, text: row.text as string, done: Boolean(row.done), position: Number(row.position ?? 0) };
}

function mapLink(row: Record<string, unknown>): StepLink {
  return { id: row.id as string, label: row.label as string, url: row.url as string };
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

export function mapHistory(row: Record<string, unknown>): HistoryEntry {
  return {
    id: row.id as string,
    dossierId: row.dossier_id as string,
    from: row.from_date as string,
    to: (row.to_date as string) ?? "",
    type: row.type as HistoryEntry["type"],
    activity: (row.activity as string) ?? "",
    org: (row.org as string) ?? "",
    place: (row.place as string) ?? "",
    parallel: Boolean(row.parallel),
  };
}

export function mapAddress(row: Record<string, unknown>): AddressEntry {
  return {
    id: row.id as string,
    dossierId: row.dossier_id as string,
    from: row.from_date as string,
    to: (row.to_date as string) ?? "",
    address: (row.address as string) ?? "",
    city: (row.city as string) ?? "",
    note: (row.note as string) ?? "",
    parallel: Boolean(row.parallel),
  };
}
