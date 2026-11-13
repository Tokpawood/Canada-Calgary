import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddressEntry,
  Contact,
  DocumentCheck,
  DocumentRecord,
  Dossier,
  Gap,
  FswProfile,
  HistoryEntry,
  Identity,
  Profile,
  Saving,
  Step,
  SubTask,
  VaultFile,
  Link as StepLink,
} from "./types";

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

export async function getDocumentsWithDetails(supabase: SupabaseClient, dossierId: string): Promise<DocumentRecord[]> {
  const { data: docs } = await supabase.from("document").select("*").eq("dossier_id", dossierId).order("position");
  const ids = (docs ?? []).map((d) => d.id as string);

  const [{ data: checks }, { data: links }, { data: files }] = await Promise.all([
    ids.length
      ? supabase.from("document_check").select("id,document_id,text,done,position").in("document_id", ids).order("position")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabase.from("document_link").select("id,document_id,label,url,position").in("document_id", ids).order("position")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabase.from("file").select("*").in("document_id", ids).order("uploaded_at")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const checksByDoc = groupBy(checks ?? [], (c) => c.document_id as string);
  const linksByDoc = groupBy(links ?? [], (l) => l.document_id as string);
  const filesByDoc = groupBy(files ?? [], (f) => f.document_id as string);

  return (docs ?? []).map((d) =>
    mapDocument(
      d,
      checksByDoc.get(d.id as string) ?? [],
      linksByDoc.get(d.id as string) ?? [],
      filesByDoc.get(d.id as string) ?? [],
    ),
  );
}

function mapDocument(
  row: Record<string, unknown>,
  checks: Record<string, unknown>[],
  links: Record<string, unknown>[],
  files: Record<string, unknown>[],
): DocumentRecord {
  return {
    id: row.id as string,
    dossierId: row.dossier_id as string,
    name: row.name as string,
    status: row.status as DocumentRecord["status"],
    use: (row.use_ as string) ?? "",
    from: (row.from_org as string) ?? "",
    date: (row.date as string) ?? "",
    notes: (row.notes as string) ?? "",
    req: row.req as DocumentRecord["req"],
    format: (row.format as string) ?? "",
    validity: (row.validity as string) ?? "",
    checks: checks.map(mapDocumentCheck),
    links: links.map(mapLink),
    files: files.map(mapVaultFile),
  };
}

function mapDocumentCheck(row: Record<string, unknown>): DocumentCheck {
  return { id: row.id as string, text: row.text as string, done: Boolean(row.done), position: Number(row.position ?? 0) };
}

export function mapVaultFile(row: Record<string, unknown>): VaultFile {
  return {
    id: row.id as string,
    documentId: (row.document_id as string | null) ?? null,
    storagePath: row.storage_path as string,
    name: row.name as string,
    size: Number(row.size ?? 0),
    mime: row.mime as string,
    uploadedAt: row.uploaded_at as string,
  };
}

export async function getVaultFiles(supabase: SupabaseClient, dossierId: string): Promise<VaultFile[]> {
  const { data } = await supabase.from("file").select("*").eq("dossier_id", dossierId).order("uploaded_at");
  return (data ?? []).map(mapVaultFile);
}

export async function getGaps(supabase: SupabaseClient, dossierId: string): Promise<Gap[]> {
  const { data } = await supabase.from("gap").select("*").eq("dossier_id", dossierId).order("position");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    dossierId: row.dossier_id as string,
    text: row.text as string,
    done: Boolean(row.done),
  }));
}

export async function getIdentity(supabase: SupabaseClient, dossierId: string): Promise<Identity | null> {
  const { data } = await supabase.from("identity").select("*").eq("dossier_id", dossierId).maybeSingle();
  if (!data) return null;
  return {
    dossierId: data.dossier_id as string,
    nom: (data.nom as string) ?? "",
    prenoms: (data.prenoms as string) ?? "",
    naissance: (data.naissance as string | null) ?? null,
    lieu: (data.lieu as string) ?? "",
    pere: (data.pere as string) ?? "",
    mere: (data.mere as string) ?? "",
    statut: (data.statut as string) ?? "",
  };
}

export async function getContacts(supabase: SupabaseClient, dossierId: string): Promise<Contact[]> {
  const { data } = await supabase.from("contact").select("*").eq("dossier_id", dossierId).order("position");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    dossierId: row.dossier_id as string,
    org: (row.org as string) ?? "",
    role: (row.role as string) ?? "",
    contact: (row.contact as string) ?? "",
    person: (row.person as string) ?? "",
    next: (row.next as string) ?? "",
    notes: (row.notes as string) ?? "",
  }));
}

export async function getProfile(supabase: SupabaseClient, dossierId: string): Promise<Profile> {
  const { data } = await supabase.from("profile").select("*").eq("dossier_id", dossierId).maybeSingle();
  return {
    dossierId,
    titre: (data?.titre as string) ?? "",
    enfants: (data?.enfants as string) ?? "",
    nationalite: (data?.nationalite as string) ?? "",
    passeport: (data?.passeport as string) ?? "",
    telephone: (data?.telephone as string) ?? "",
    courriel: (data?.courriel as string) ?? "",
    permis: (data?.permis as string) ?? "",
    adresse: (data?.adresse as string) ?? "",
    programme: (data?.programme as string) ?? "",
    cnp: (data?.cnp as string) ?? "",
    ville: (data?.ville as string) ?? "",
    repli: (data?.repli as string) ?? "",
  };
}

export async function getFsw(supabase: SupabaseClient, dossierId: string): Promise<FswProfile> {
  const { data } = await supabase.from("fsw").select("*").eq("dossier_id", dossierId).maybeSingle();
  return {
    dossierId,
    first: (data?.first as FswProfile["first"]) ?? "fr",
    fr_co: (data?.fr_co as string) ?? "",
    fr_ce: (data?.fr_ce as string) ?? "",
    fr_eo: (data?.fr_eo as string) ?? "",
    fr_ee: (data?.fr_ee as string) ?? "",
    en_co: (data?.en_co as string) ?? "",
    en_ce: (data?.en_ce as string) ?? "",
    en_eo: (data?.en_eo as string) ?? "",
    en_ee: (data?.en_ee as string) ?? "",
    edu: (data?.edu as string) ?? "",
    arranged: (data?.arranged as FswProfile["arranged"]) ?? "0",
    adapt: (data?.adapt as FswProfile["adapt"]) ?? "0",
  };
}

export async function getHistoryEntries(supabase: SupabaseClient, dossierId: string): Promise<HistoryEntry[]> {
  const { data } = await supabase.from("history").select("*").eq("dossier_id", dossierId).order("position");
  return (data ?? []).map(mapHistory);
}

export async function getAddressEntries(supabase: SupabaseClient, dossierId: string): Promise<AddressEntry[]> {
  const { data } = await supabase.from("address").select("*").eq("dossier_id", dossierId).order("position");
  return (data ?? []).map(mapAddress);
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
