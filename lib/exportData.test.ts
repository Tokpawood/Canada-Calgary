import { describe, expect, it } from "vitest";
import { rawDossierSchema } from "./import";
import { toRawDossierJson, type FullBundle } from "./exportData";

const bundle: FullBundle = {
  dossier: { id: "dossier-1", ownerId: "owner-1", profileDate: "2027-05-31", fundsMin: 6258000, fundsMinCad: 15263, fundsTarget: 7000000, cadRate: 410 },
  identity: { dossierId: "dossier-1", nom: "N", prenoms: "P", naissance: "2000-01-01", lieu: "L", pere: "", mere: "", statut: "" },
  profile: { dossierId: "dossier-1", titre: "", enfants: "", nationalite: "", passeport: "", telephone: "", courriel: "", permis: "", adresse: "", programme: "", cnp: "", ville: "", repli: "" },
  fsw: { dossierId: "dossier-1", first: "fr", fr_co: "9", fr_ce: "9", fr_eo: "9", fr_ee: "9", en_co: "", en_ce: "", en_eo: "", en_ee: "", edu: "p3", arranged: "0", adapt: "0" },
  steps: [
    {
      id: "s1",
      dossierId: "dossier-1",
      phase: "1. Mise en ordre",
      title: "Étape",
      due: "2026-12-01",
      status: "Fait",
      planned: 1000,
      actual: 1000,
      org: "X",
      req: "Y",
      notes: "Z",
      risk: "R",
      position: 0,
      tasks: [{ id: "t1", text: "a", done: true, position: 0 }],
      links: [{ id: "l1", label: "Lien", url: "https://exemple.ca" }],
    },
  ],
  documents: [
    {
      id: "d1",
      dossierId: "dossier-1",
      name: "Passeport",
      status: "Obtenu",
      use: "Profil",
      from: "Org",
      date: "2026-01-01",
      notes: "",
      req: "Obligatoire",
      format: "PDF",
      validity: "5 ans",
      expires: "2031-01-01",
      checks: [{ id: "c1", text: "vérifié", done: true, position: 0 }],
      links: [],
      files: [],
    },
  ],
  savings: [{ id: "e1", dossierId: "dossier-1", label: "Nov", planned: 100, actual: 50, notes: "" }],
  contacts: [{ id: "ct1", dossierId: "dossier-1", org: "Org", role: "Rôle", contact: "", person: "", next: "", notes: "", stage: "en-contact" }],
  persons: [
    {
      id: "p1",
      dossierId: "dossier-1",
      contactId: null,
      parentId: null,
      name: "Coursier",
      title: "",
      email: "",
      phone: "0102",
      notes: "",
      position: 0,
      relation: "Coursier",
      whatsapp: "",
      website: "",
      address: "",
      city: "",
      country: "",
      birthDate: null,
      nationality: "",
      idType: "CNI",
      idNumber: "X1",
      photoPath: null,
      photoUrl: null,
    },
  ],
  contactLinks: [{ id: "l1", stepId: "s1", contactId: null, personId: "p1" }],
  gaps: [{ id: "g1", dossierId: "dossier-1", text: "écart", done: false }],
  history: [{ id: "h1", dossierId: "dossier-1", from: "2018-01-01", to: "2020-01-01", type: "Travail", activity: "Emploi", org: "", place: "", parallel: false }],
  addresses: [{ id: "a1", dossierId: "dossier-1", from: "2018-01-01", to: "", address: "Adresse", city: "Ville", note: "", parallel: false }],
};

describe("toRawDossierJson", () => {
  it("produit un objet compatible avec le schéma d'import (export == ré-import)", () => {
    const raw = toRawDossierJson(bundle);
    const parsed = rawDossierSchema.parse(raw);
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.docs).toHaveLength(1);
    expect(parsed.history).toHaveLength(1);
    expect(parsed.addresses).toHaveLength(1);
    expect(raw.steps[0].sub).toEqual([{ t: "a", done: true }]);
    expect(raw.docs[0].checks).toEqual([{ t: "vérifié", done: true }]);
  });
});

describe("réseau des contacts à l'export et au ré-import", () => {
  it("garde les personnes indépendantes, leur identité et leurs tâches liées", async () => {
    const { buildImportPlan } = await import("./import");
    const parsed = rawDossierSchema.parse(toRawDossierJson(bundle));
    expect(parsed.contacts[0].stage).toBe("en-contact");
    const plan = buildImportPlan("dossier-2", parsed);
    const [person] = plan.peopleLevels.flat();
    expect(person).toMatchObject({ dossier_id: "dossier-2", contact_id: null, name: "Coursier", relation: "Coursier" });
    expect(person).not.toHaveProperty("id_number");
    expect(plan.peoplePrivate).toEqual([{ person_id: person.id, dossier_id: "dossier-2", birth_date: null, nationality: "", id_type: "CNI", id_number: "X1" }]);
    expect(plan.contactLinks).toEqual([{ step_id: "s1", contact_id: null, person_id: person.id }]);
  });

  it("insère chaque responsable avant ses collaborateurs", async () => {
    const { buildImportPlan } = await import("./import");
    const raw = rawDossierSchema.parse(toRawDossierJson(bundle));
    raw.people = [
      { ...raw.people[0], id: "b", contact: "ct1", parent: "a", name: "Agent" },
      { ...raw.people[0], id: "a", contact: "ct1", parent: null, name: "Chef" },
    ];
    const plan = buildImportPlan("d", raw);
    expect(plan.peopleLevels.map((l) => l.map((p) => p.name))).toEqual([["Chef"], ["Agent"]]);
    expect(plan.peopleLevels[1][0].parent_id).toBe(plan.peopleLevels[0][0].id);
  });
});
