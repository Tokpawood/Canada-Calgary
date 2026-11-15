import type { StepStatus } from "./types";

/** Réseau des contacts : personnes rattachées à un organisme, organisées en mini-organigramme, et liens vers les étapes. */

export interface ContactPerson {
  id: string;
  dossierId: string;
  /** null : personne indépendante (coursier, ami, voisin…), sans organisme. */
  contactId: string | null;
  parentId: string | null;
  name: string;
  title: string;
  email: string;
  phone: string;
  notes: string;
  position: number;
  /** Ce qu'elle est pour vous (coursier, ami, chauffeur…), surtout pour les indépendants. */
  relation: string;
  whatsapp: string;
  website: string;
  address: string;
  city: string;
  country: string;
  birthDate: string | null;
  nationality: string;
  idType: string;
  idNumber: string;
  photoPath: string | null;
  /** Lien signé temporaire vers la photo. */
  photoUrl: string | null;
}

/** Champs d'identification modifiables d'une personne. */
export const PERSON_FIELDS = ["name", "title", "relation", "email", "phone", "whatsapp", "website", "address", "city", "country", "birthDate", "nationality", "idType", "idNumber", "notes"] as const;
export type PersonField = (typeof PERSON_FIELDS)[number];
/** Champs d'identité rangés à part (table contact_person_private) : visibles du seul titulaire. */
export const PRIVATE_FIELDS: readonly PersonField[] = ["birthDate", "nationality", "idType", "idNumber"];
export const PERSON_COLUMNS: Record<PersonField, string> = {
  name: "name",
  title: "title",
  relation: "relation",
  email: "email",
  phone: "phone",
  whatsapp: "whatsapp",
  website: "website",
  address: "address",
  city: "city",
  country: "country",
  birthDate: "birth_date",
  nationality: "nationality",
  idType: "id_type",
  idNumber: "id_number",
  notes: "notes",
};

export interface StepLite {
  id: string;
  title: string;
  phase: string;
  status: StepStatus;
  due: string | null;
}

export interface ContactStepLink {
  id: string;
  stepId: string;
  contactId: string | null;
  personId: string | null;
}

export function mapPerson(row: Record<string, unknown>): ContactPerson {
  return {
    id: row.id as string,
    dossierId: row.dossier_id as string,
    contactId: (row.contact_id as string | null) ?? null,
    parentId: (row.parent_id as string | null) ?? null,
    name: (row.name as string) ?? "",
    title: (row.title as string) ?? "",
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    notes: (row.notes as string) ?? "",
    position: Number(row.position ?? 0),
    relation: (row.relation as string) ?? "",
    whatsapp: (row.whatsapp as string) ?? "",
    website: (row.website as string) ?? "",
    address: (row.address as string) ?? "",
    city: (row.city as string) ?? "",
    country: (row.country as string) ?? "",
    birthDate: (row.birth_date as string | null) ?? null,
    nationality: (row.nationality as string) ?? "",
    idType: (row.id_type as string) ?? "",
    idNumber: (row.id_number as string) ?? "",
    photoPath: (row.photo_path as string | null) ?? null,
    photoUrl: null,
  };
}

export function mapContactStep(row: Record<string, unknown>): ContactStepLink {
  return { id: row.id as string, stepId: row.step_id as string, contactId: (row.contact_id as string | null) ?? null, personId: (row.person_id as string | null) ?? null };
}

export interface OrgNode {
  person: ContactPerson;
  depth: number;
  /** Nombre de personnes sous elle (à toute profondeur). */
  reports: number;
}

/**
 * Organigramme d'un organisme, à plat dans l'ordre de lecture (parent puis ses subordonnés).
 * Une personne dont le responsable est inconnu (ou dans une boucle) remonte à la racine.
 */
export function orgChart(persons: ContactPerson[]): OrgNode[] {
  const ids = new Set(persons.map((p) => p.id));
  const byParent = new Map<string | null, ContactPerson[]>();
  const rootOf = (p: ContactPerson) => (p.parentId && ids.has(p.parentId) && p.parentId !== p.id ? p.parentId : null);
  for (const p of persons) {
    const k = rootOf(p);
    byParent.set(k, [...(byParent.get(k) ?? []), p]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "fr"));

  const out: OrgNode[] = [];
  const seen = new Set<string>();
  const walk = (p: ContactPerson, depth: number): number => {
    seen.add(p.id);
    const node: OrgNode = { person: p, depth, reports: 0 };
    out.push(node);
    for (const c of byParent.get(p.id) ?? []) if (!seen.has(c.id)) node.reports += 1 + walk(c, depth + 1);
    return node.reports;
  };
  for (const r of byParent.get(null) ?? []) walk(r, 0);
  // Personnes prises dans une boucle (A sous B, B sous A) : affichées à la racine plutôt que perdues.
  for (const p of persons) if (!seen.has(p.id)) walk(p, 0);
  return out;
}

/** Une personne peut passer sous `parentId` si ce n'est ni elle-même ni l'un de ses subordonnés. */
export function canReportTo(persons: ContactPerson[], id: string, parentId: string | null): boolean {
  if (parentId === null) return true;
  if (parentId === id) return false;
  const target = persons.find((p) => p.id === parentId);
  const self = persons.find((p) => p.id === id);
  if (!target || (self && target.contactId !== self.contactId)) return false;
  const below = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of persons) {
      if (p.parentId && below.has(p.parentId) && !below.has(p.id)) {
        below.add(p.id);
        grew = true;
      }
    }
  }
  return !below.has(parentId);
}

export function personLabel(p: Pick<ContactPerson, "name" | "title">): string {
  return p.title ? `${p.name} · ${p.title}` : p.name;
}

export const CONTACT_STAGES: Array<{ id: import("./types").ContactStage; label: string; hint: string }> = [
  { id: "a-contacter", label: "À contacter", hint: "Pas encore de premier échange" },
  { id: "en-contact", label: "En contact", hint: "Échanges en cours" },
  { id: "en-attente", label: "En attente", hint: "Une réponse ou un document est attendu" },
  { id: "etabli", label: "Relation établie", hint: "Interlocuteur fiable, on peut compter dessus" },
  { id: "termine", label: "Terminé", hint: "Plus d'action prévue" },
];
