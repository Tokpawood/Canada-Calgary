import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAddressEntries,
  getContacts,
  getNetwork,
  getDocumentsWithDetails,
  getFsw,
  getGaps,
  getHistoryEntries,
  getIdentity,
  getProfile,
  getSavings,
  getStepsWithDetails,
} from "./queries";
import type {
  AddressEntry,
  Contact,
  DocumentRecord,
  Dossier,
  FswProfile,
  Gap,
  HistoryEntry,
  Identity,
  Profile,
  Saving,
  Step,
} from "./types";

export interface FullBundle {
  dossier: Dossier;
  identity: Identity;
  profile: Profile;
  fsw: FswProfile;
  steps: Step[];
  documents: DocumentRecord[];
  savings: Saving[];
  contacts: Contact[];
  gaps: Gap[];
  history: HistoryEntry[];
  addresses: AddressEntry[];
}

export async function getFullBundle(supabase: SupabaseClient, dossier: Dossier): Promise<FullBundle> {
  const [identity, profile, fsw, steps, documents, savings, contacts, gaps, history, addresses] = await Promise.all([
    getIdentity(supabase, dossier.id),
    getProfile(supabase, dossier.id),
    getFsw(supabase, dossier.id),
    getStepsWithDetails(supabase, dossier.id),
    getDocumentsWithDetails(supabase, dossier.id),
    getSavings(supabase, dossier.id),
    getContacts(supabase, dossier.id),
    getGaps(supabase, dossier.id),
    getHistoryEntries(supabase, dossier.id),
    getAddressEntries(supabase, dossier.id),
  ]);

  // Les personnes de chaque organisme reprennent la place de l'ancien champ « interlocuteur » (texte) dans les exports.
  const { persons } = await getNetwork(supabase, dossier.id);
  for (const c of contacts) {
    const team = persons.filter((p) => p.contactId === c.id).map((p) => [p.name, p.title, p.email, p.phone].filter(Boolean).join(", "));
    if (team.length) c.person = team.join(" ; ");
  }

  return {
    dossier,
    identity: identity ?? { dossierId: dossier.id, nom: "", prenoms: "", naissance: null, lieu: "", pere: "", mere: "", statut: "" },
    profile,
    fsw,
    steps,
    documents,
    savings,
    contacts,
    gaps,
    history,
    addresses,
  };
}

/** Reconstruit la forme `etat-complet.json` du prototype, pour qu'un export se ré-importe à l'identique. */
export function toRawDossierJson(bundle: FullBundle) {
  return {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    profileDate: bundle.dossier.profileDate,
    fundsMin: bundle.dossier.fundsMin,
    fundsTarget: bundle.dossier.fundsTarget,
    steps: bundle.steps.map((s) => ({
      id: s.id,
      phase: s.phase,
      title: s.title,
      due: s.due,
      status: s.status,
      planned: s.planned,
      actual: s.actual,
      org: s.org,
      req: s.req,
      notes: s.notes,
      risk: s.risk,
      sub: s.tasks.map((t) => ({ t: t.text, done: t.done })),
      links: s.links.map((l) => ({ l: l.label, u: l.url })),
    })),
    docs: bundle.documents.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      use: d.use,
      from: d.from,
      date: d.date,
      notes: d.notes,
      req: d.req,
      format: d.format,
      validity: d.validity,
      checks: d.checks.map((c) => ({ t: c.text, done: c.done })),
      links: d.links.map((l) => ({ l: l.label, u: l.url })),
      files: [] as unknown[],
    })),
    savings: bundle.savings.map((s) => ({ id: s.id, label: s.label, planned: s.planned, actual: s.actual, notes: s.notes })),
    contacts: bundle.contacts.map((c) => ({ id: c.id, org: c.org, role: c.role, contact: c.contact, person: c.person, next: c.next, notes: c.notes })),
    identity: { nom: bundle.identity.nom, prenoms: bundle.identity.prenoms, naissance: bundle.identity.naissance ?? "", lieu: bundle.identity.lieu, pere: bundle.identity.pere, mere: bundle.identity.mere, statut: bundle.identity.statut },
    gaps: bundle.gaps.map((g) => ({ t: g.text, done: g.done })),
    history: bundle.history.map((h) => ({ id: h.id, from: h.from, to: h.to, type: h.type, activity: h.activity, org: h.org, place: h.place, parallel: h.parallel })),
    addresses: bundle.addresses.map((a) => ({ id: a.id, from: a.from, to: a.to, address: a.address, city: a.city, note: a.note, parallel: a.parallel })),
    profile: bundle.profile,
    fsw: bundle.fsw,
  };
}
