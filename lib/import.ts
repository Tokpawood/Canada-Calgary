import { z } from "zod";

const subTaskSchema = z.object({ t: z.string(), done: z.boolean().default(false) });
const linkSchema = z.object({ l: z.string(), u: z.string() });

const stepSchema = z.object({
  id: z.string(),
  phase: z.string(),
  title: z.string(),
  due: z.string().nullable().optional(),
  status: z.enum(["À faire", "En cours", "Bloqué", "Fait", "Si nécessaire"]).default("À faire"),
  planned: z.number().nullable().optional(),
  actual: z.number().nullable().optional(),
  org: z.string().optional().default(""),
  req: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  risk: z.string().optional().default(""),
  sub: z.array(subTaskSchema).optional().default([]),
  links: z.array(linkSchema).optional().default([]),
});

const docSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["À obtenir", "Demandé", "Obtenu"]).default("À obtenir"),
  use: z.string().optional().default(""),
  from: z.string().optional().default(""),
  date: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  req: z.enum(["Obligatoire", "Conseillé", "Si applicable"]).default("Obligatoire"),
  format: z.string().optional().default(""),
  validity: z.string().optional().default(""),
  checks: z.array(subTaskSchema).optional().default([]),
  links: z.array(linkSchema).optional().default([]),
});

const savingSchema = z.object({
  id: z.string(),
  label: z.string(),
  planned: z.number().nullable().optional(),
  actual: z.number().nullable().optional(),
  notes: z.string().optional().default(""),
});

const contactSchema = z.object({
  id: z.string(),
  org: z.string().optional().default(""),
  role: z.string().optional().default(""),
  contact: z.string().optional().default(""),
  person: z.string().optional().default(""),
  next: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  stage: z.enum(["a-contacter", "en-contact", "en-attente", "etabli", "termine"]).optional(),
});

const str = z.string().optional().default("");
const personSchema = z.object({
  id: z.string(),
  contact: z.string().nullable().optional(),
  parent: z.string().nullable().optional(),
  name: z.string().min(1).max(120),
  title: str,
  relation: str,
  email: str,
  phone: str,
  whatsapp: str,
  website: str,
  address: str,
  city: str,
  country: str,
  birth: z.string().nullable().optional(),
  nationality: str,
  idType: str,
  idNumber: str,
  notes: str,
});
const contactLinkSchema = z.object({ step: z.string(), contact: z.string().nullable().optional(), person: z.string().nullable().optional() });

const gapSchema = z.object({ t: z.string(), done: z.boolean().default(false) });

const historySchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string().optional().default(""),
  type: z.enum(["Travail", "Études", "Sans emploi", "Autre"]).default("Autre"),
  activity: z.string().optional().default(""),
  org: z.string().optional().default(""),
  place: z.string().optional().default(""),
  parallel: z.boolean().optional().default(false),
});

const addressSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string().optional().default(""),
  address: z.string().optional().default(""),
  city: z.string().optional().default(""),
  note: z.string().optional().default(""),
  parallel: z.boolean().optional().default(false),
});

const identitySchema = z.object({
  nom: z.string().optional().default(""),
  prenoms: z.string().optional().default(""),
  naissance: z.string().optional().default(""),
  lieu: z.string().optional().default(""),
  pere: z.string().optional().default(""),
  mere: z.string().optional().default(""),
  statut: z.string().optional().default(""),
});

const profileSchema = z.object({
  titre: z.string().optional().default(""),
  enfants: z.string().optional().default(""),
  nationalite: z.string().optional().default(""),
  passeport: z.string().optional().default(""),
  telephone: z.string().optional().default(""),
  courriel: z.string().optional().default(""),
  permis: z.string().optional().default(""),
  adresse: z.string().optional().default(""),
  programme: z.string().optional().default(""),
  cnp: z.string().optional().default(""),
  ville: z.string().optional().default(""),
  repli: z.string().optional().default(""),
});

const fswSchema = z.object({
  first: z.enum(["fr", "en"]).default("fr"),
  fr_co: z.string().optional().default(""),
  fr_ce: z.string().optional().default(""),
  fr_eo: z.string().optional().default(""),
  fr_ee: z.string().optional().default(""),
  en_co: z.string().optional().default(""),
  en_ce: z.string().optional().default(""),
  en_eo: z.string().optional().default(""),
  en_ee: z.string().optional().default(""),
  edu: z.string().optional().default(""),
  arranged: z.enum(["0", "10"]).default("0"),
  adapt: z.enum(["0", "5", "10"]).default("0"),
});

const EMPTY_IDENTITY = { nom: "", prenoms: "", naissance: "", lieu: "", pere: "", mere: "", statut: "" };
const EMPTY_PROFILE = {
  titre: "",
  enfants: "",
  nationalite: "",
  passeport: "",
  telephone: "",
  courriel: "",
  permis: "",
  adresse: "",
  programme: "",
  cnp: "",
  ville: "",
  repli: "",
};
const EMPTY_FSW = {
  first: "fr" as const,
  fr_co: "",
  fr_ce: "",
  fr_eo: "",
  fr_ee: "",
  en_co: "",
  en_ce: "",
  en_eo: "",
  en_ee: "",
  edu: "",
  arranged: "0" as const,
  adapt: "0" as const,
};

export const rawDossierSchema = z.object({
  profileDate: z.string().nullable().optional(),
  fundsMin: z.number().optional().default(0),
  fundsTarget: z.number().optional().default(0),
  steps: z.array(stepSchema),
  docs: z.array(docSchema),
  savings: z.array(savingSchema).optional().default([]),
  contacts: z.array(contactSchema).optional().default([]),
  people: z.array(personSchema).optional().default([]),
  contactLinks: z.array(contactLinkSchema).optional().default([]),
  identity: identitySchema.optional().default(EMPTY_IDENTITY),
  gaps: z.array(gapSchema).optional().default([]),
  history: z.array(historySchema).optional().default([]),
  addresses: z.array(addressSchema).optional().default([]),
  profile: profileSchema.optional().default(EMPTY_PROFILE),
  fsw: fswSchema.optional().default(EMPTY_FSW),
});

export type RawDossier = z.infer<typeof rawDossierSchema>;

export interface ImportPlan {
  dossier: { profile_date: string | null; funds_min: number; funds_target: number };
  identity: Record<string, string | null>;
  profile: Record<string, string>;
  fsw: Record<string, string>;
  steps: Array<Record<string, unknown>>;
  stepTasks: Array<Record<string, unknown>>;
  stepLinks: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  documentChecks: Array<Record<string, unknown>>;
  documentLinks: Array<Record<string, unknown>>;
  savings: Array<Record<string, unknown>>;
  contacts: Array<Record<string, unknown>>;
  /** Personnes par niveau d'organigramme : chaque niveau s'insère après celui de ses responsables. */
  peopleLevels: Array<Array<Record<string, unknown>>>;
  contactLinks: Array<Record<string, unknown>>;
  gaps: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  addresses: Array<Record<string, unknown>>;
  counts: { steps: number; documents: number; history: number; addresses: number };
}

let genCounter = 0;
function genId(prefix: string): string {
  genCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${genCounter}`;
}

export function buildImportPlan(dossierId: string, raw: RawDossier): ImportPlan {
  const stepTasks: Array<Record<string, unknown>> = [];
  const stepLinks: Array<Record<string, unknown>> = [];
  const steps = raw.steps.map((s, i) => {
    s.sub.forEach((t, j) => stepTasks.push({ step_id: s.id, text: t.t, done: t.done, position: j }));
    s.links.forEach((l, j) => stepLinks.push({ step_id: s.id, label: l.l, url: l.u, position: j }));
    return {
      id: s.id,
      dossier_id: dossierId,
      phase: s.phase,
      title: s.title,
      due: s.due || null,
      status: s.status,
      planned: s.planned ?? null,
      actual: s.actual ?? null,
      org: s.org,
      req: s.req,
      notes: s.notes,
      risk: s.risk,
      position: i,
    };
  });

  const documentChecks: Array<Record<string, unknown>> = [];
  const documentLinks: Array<Record<string, unknown>> = [];
  const documents = raw.docs.map((d, i) => {
    d.checks.forEach((c, j) => documentChecks.push({ document_id: d.id, text: c.t, done: c.done, position: j }));
    d.links.forEach((l, j) => documentLinks.push({ document_id: d.id, label: l.l, url: l.u, position: j }));
    return {
      id: d.id,
      dossier_id: dossierId,
      name: d.name,
      status: d.status,
      use_: d.use,
      from_org: d.from,
      date: d.date || null,
      notes: d.notes,
      req: d.req,
      format: d.format,
      validity: d.validity,
      position: i,
    };
  });

  const savings = raw.savings.map((s, i) => ({
    id: s.id,
    dossier_id: dossierId,
    label: s.label,
    planned: s.planned ?? null,
    actual: s.actual ?? null,
    notes: s.notes,
    position: i,
  }));

  const contacts = raw.contacts.map((c, i) => ({
    id: c.id,
    dossier_id: dossierId,
    org: c.org,
    role: c.role,
    contact: c.contact,
    person: c.person,
    next: c.next,
    notes: c.notes,
    ...(c.stage ? { stage: c.stage } : {}),
    position: i,
  }));

  // Nouveaux identifiants pour les personnes ; les références (organisme, responsable, liens) suivent.
  const contactIds = new Set(raw.contacts.map((c) => c.id));
  const stepIds = new Set(raw.steps.map((s) => s.id));
  const newIdOf = new Map(raw.people.map((p) => [p.id, crypto.randomUUID()]));
  const byOld = new Map(raw.people.map((p) => [p.id, p]));
  const orgOf = (p: (typeof raw.people)[number]) => (p.contact && contactIds.has(p.contact) ? p.contact : null);
  const parentOf = (p: (typeof raw.people)[number]) => {
    const parent = p.parent ? byOld.get(p.parent) : undefined;
    return parent && parent.id !== p.id && orgOf(parent) === orgOf(p) ? parent.id : null;
  };
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    const p = byOld.get(id)!;
    const parent = parentOf(p);
    const d = parent && !seen.has(parent) ? depthOf(parent, new Set([...seen, id])) + 1 : 0;
    depth.set(id, d);
    return d;
  };
  const peopleLevels: Array<Array<Record<string, unknown>>> = [];
  raw.people.forEach((p, i) => {
    const d = depthOf(p.id);
    const parent = parentOf(p);
    // En cas de boucle, la personne remonte en haut de l'organigramme.
    const parentId = parent && depthOf(parent) < d ? newIdOf.get(parent) : null;
    (peopleLevels[d] ??= []).push({
      id: newIdOf.get(p.id),
      dossier_id: dossierId,
      contact_id: orgOf(p),
      parent_id: parentId,
      name: p.name,
      title: p.title,
      relation: p.relation,
      email: p.email,
      phone: p.phone,
      whatsapp: p.whatsapp,
      website: p.website,
      address: p.address,
      city: p.city,
      country: p.country,
      birth_date: p.birth && /^\d{4}-\d{2}-\d{2}$/.test(p.birth) ? p.birth : null,
      nationality: p.nationality,
      id_type: p.idType,
      id_number: p.idNumber,
      notes: p.notes,
      position: i,
    });
  });
  const seenLinks = new Set<string>();
  const contactLinks = raw.contactLinks.flatMap((l) => {
    const person = l.person ? byOld.get(l.person) : undefined;
    const personId = person ? newIdOf.get(person.id)! : null;
    const contactId = person ? orgOf(person) : l.contact && contactIds.has(l.contact) ? l.contact : null;
    if (!stepIds.has(l.step) || (!personId && !contactId)) return [];
    const key = `${l.step}|${contactId}|${personId}`;
    if (seenLinks.has(key)) return [];
    seenLinks.add(key);
    return [{ step_id: l.step, contact_id: contactId, person_id: personId }];
  });

  const gaps = raw.gaps.map((g, i) => ({ id: genId("gap"), dossier_id: dossierId, text: g.t, done: g.done, position: i }));

  const history = raw.history.map((h, i) => ({
    id: h.id ?? genId("hist"),
    dossier_id: dossierId,
    from_date: h.from,
    to_date: h.to,
    type: h.type,
    activity: h.activity,
    org: h.org,
    place: h.place,
    parallel: h.parallel,
    position: i,
  }));

  const addresses = raw.addresses.map((a, i) => ({
    id: a.id ?? genId("addr"),
    dossier_id: dossierId,
    from_date: a.from,
    to_date: a.to,
    address: a.address,
    city: a.city,
    note: a.note,
    parallel: a.parallel,
    position: i,
  }));

  return {
    dossier: { profile_date: raw.profileDate || null, funds_min: raw.fundsMin, funds_target: raw.fundsTarget },
    identity: { ...raw.identity, naissance: raw.identity.naissance || null },
    profile: raw.profile,
    fsw: raw.fsw,
    steps,
    stepTasks,
    stepLinks,
    documents,
    documentChecks,
    documentLinks,
    savings,
    contacts,
    peopleLevels: peopleLevels.filter(Boolean),
    contactLinks,
    gaps,
    history,
    addresses,
    counts: { steps: steps.length, documents: documents.length, history: history.length, addresses: addresses.length },
  };
}
