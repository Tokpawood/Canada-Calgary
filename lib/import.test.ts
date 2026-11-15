import { describe, expect, it } from "vitest";
import { buildImportPlan, rawDossierSchema } from "./import";

const sample = {
  profileDate: "2027-05-31",
  fundsMin: 6258000,
  fundsTarget: 7000000,
  steps: [
    {
      id: "s1",
      phase: "1. Mise en ordre",
      title: "Étape",
      due: "2026-12-01",
      status: "Fait",
      planned: 1000,
      actual: 1000,
      org: "X",
      req: "Y",
      notes: "Z",
      sub: [{ t: "a", done: true }],
      risk: "R",
      links: [{ l: "Lien", u: "https://exemple.ca" }],
    },
  ],
  docs: [
    {
      id: "d1",
      name: "Passeport",
      status: "Obtenu",
      use: "Profil",
      from: "Org",
      date: "2026-01-01",
      notes: "",
      req: "Obligatoire",
      format: "PDF",
      validity: "5 ans",
      checks: [{ t: "vérifié", done: false }],
      links: [],
    },
  ],
  savings: [{ id: "e1", label: "Nov", planned: 100, actual: 50, notes: "" }],
  contacts: [{ id: "c1", org: "Org", role: "Rôle", contact: "", person: "", next: "", notes: "" }],
  identity: { nom: "N", prenoms: "P", naissance: "2000-01-01", lieu: "L", pere: "", mere: "", statut: "" },
  gaps: [{ t: "écart", done: false }],
  history: [{ from: "2018-01-01", to: "2020-01-01", type: "Travail", activity: "Emploi", org: "", place: "", parallel: false }],
  addresses: [{ from: "2018-01-01", to: "", address: "Adresse", city: "Ville", note: "" }],
  profile: { titre: "T" },
  fsw: { first: "fr", edu: "p3" },
};

describe("import JSON -> plan normalisé", () => {
  it("valide et répartit les tables imbriquées", () => {
    const raw = rawDossierSchema.parse(sample);
    const plan = buildImportPlan("dossier-1", raw);

    expect(plan.counts).toEqual({ steps: 1, documents: 1, history: 1, addresses: 1 });
    expect(plan.steps[0]).toMatchObject({ id: "s1", dossier_id: "dossier-1", status: "Fait" });
    expect(plan.stepTasks).toEqual([{ step_id: "s1", text: "a", done: true, position: 0 }]);
    expect(plan.stepLinks).toEqual([{ step_id: "s1", label: "Lien", url: "https://exemple.ca", position: 0 }]);
    expect(plan.documentChecks).toEqual([{ document_id: "d1", text: "vérifié", done: false, position: 0 }]);
    expect(plan.gaps[0]).toMatchObject({ dossier_id: "dossier-1", text: "écart", done: false });
    expect(plan.history[0]).toMatchObject({ from_date: "2018-01-01", type: "Travail" });
    expect(plan.dossier).toEqual({ profile_date: "2027-05-31", funds_min: 6258000, funds_target: 7000000, funds_min_cad: null });
  });

  it("rejette un fichier sans steps/docs", () => {
    expect(() => rawDossierSchema.parse({ identity: {} })).toThrow();
  });
});
