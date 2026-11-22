import { describe, expect, it } from "vitest";
import type { DocumentRecord, VaultFile } from "./types";
import {
  joinUploadErrors,
  matchesDocQuery,
  normalizeSearch,
  obtainedWithPendingChecks,
  obtainedWithoutScan,
} from "./documents";
import { pendingDriveBackup } from "./vaultStats";

const file = (over: Partial<VaultFile> = {}): VaultFile => ({
  id: "f",
  documentId: null,
  folderId: null,
  storagePath: null,
  provider: "gdrive",
  name: "scan.pdf",
  size: 1,
  mime: "application/pdf",
  uploadedAt: "2026-01-01",
  onDrive: true,
  replacedAt: null,
  ...over,
});

const doc = (over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: "d",
  dossierId: "x",
  name: "Passeport",
  stage: "",
  status: "Obtenu",
  use: "",
  from: "",
  date: "",
  notes: "",
  req: "Obligatoire",
  format: "",
  validity: "",
  expires: "",
  position: 0,
  checks: [],
  links: [],
  files: [],
  ...over,
});

describe("pièces à numériser et à contrôler", () => {
  it("repère les pièces obtenues sans scan actif", () => {
    const docs = [
      doc({ id: "a" }),
      doc({ id: "b", files: [file()] }),
      doc({ id: "c", files: [file({ replacedAt: "2026-02-01" })] }),
      doc({ id: "d", status: "Demandé" }),
    ];
    expect(obtainedWithoutScan(docs).map((d) => d.id)).toEqual(["a", "c"]);
  });

  it("repère les pièces obtenues avec des contrôles en attente", () => {
    const docs = [
      doc({
        id: "a",
        checks: [{ id: "1", text: "x", done: false, position: 0 }],
      }),
      doc({
        id: "b",
        checks: [{ id: "2", text: "x", done: true, position: 0 }],
      }),
      doc({
        id: "c",
        status: "À obtenir",
        checks: [{ id: "3", text: "x", done: false, position: 0 }],
      }),
    ];
    expect(obtainedWithPendingChecks(docs).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("recherche", () => {
  it("ignore casse et accents", () => {
    expect(normalizeSearch("  Relevé ÉCOLE ")).toBe("releve ecole");
    expect(matchesDocQuery(doc({ name: "Relevé de notes" }), "releve")).toBe(
      true,
    );
    expect(matchesDocQuery(doc({ from: "Ministère" }), "ministere")).toBe(true);
    expect(matchesDocQuery(doc(), "diplome")).toBe(false);
    expect(matchesDocQuery(doc(), "  ")).toBe(true);
  });
});

describe("messages d'envoi", () => {
  it("regroupe les erreurs", () => {
    expect(joinUploadErrors([])).toBeNull();
    expect(joinUploadErrors(["a", "b"])).toBe("a · b");
    expect(joinUploadErrors(["a", "b", "c", "d", "e"])).toBe(
      "a · b · c · et 2 autre(s) refusé(s).",
    );
  });
});

describe("sauvegarde Drive", () => {
  it("compte les fichiers actifs pas encore copiés sur Drive", () => {
    expect(
      pendingDriveBackup([
        file({ id: "1", onDrive: false }),
        file({ id: "2" }),
        file({ id: "3", onDrive: false, replacedAt: "x" }),
      ]).map((f) => f.id),
    ).toEqual(["1"]);
  });
});

describe("validité des pièces", () => {
  it("signale les pièces expirées puis celles qui expirent sous 90 jours", async () => {
    const { expiringDocs } = await import("./documents");
    const base = {
      checks: [],
      links: [],
      files: [],
    } as unknown as DocumentRecord;
    const mk = (id: string, expires: string) => ({
      ...base,
      id,
      name: id,
      expires,
    });
    const today = new Date(2026, 10, 15);
    const r = expiringDocs(
      [
        mk("ok", "2027-12-31"),
        mk("bientot", "2027-01-10"),
        mk("expire", "2026-11-01"),
        mk("vide", ""),
        mk("jour", "2026-11-15"),
      ],
      today,
    );
    expect(r.map((x) => [x.doc.id, x.state, x.days])).toEqual([
      ["expire", "expired", -14],
      ["jour", "soon", 0],
      ["bientot", "soon", 56],
    ]);
  });
});

describe("fiche en cours de modification", () => {
  it("nettoie le nom saisi sur plusieurs lignes", async () => {
    const { cleanDocName } = await import("./documents");
    expect(cleanDocName("  Relevé\nde notes  ")).toBe("Relevé de notes");
  });

  it("refuse un nom vide et une fin de validité avant l'obtention", async () => {
    const { docDraftProblem } = await import("./documents");
    expect(docDraftProblem({ name: " \n ", date: "", expires: "" })).toMatch(/nom/);
    expect(docDraftProblem({ name: "Passeport", date: "2026-05-10", expires: "2026-05-01" })).toMatch(/validité/);
    expect(docDraftProblem({ name: "Passeport", date: "2026-05-10", expires: "2036-05-09" })).toBeNull();
    expect(docDraftProblem({ name: "Passeport", date: "", expires: "2026-01-01" })).toBeNull();
    expect(docDraftProblem({ name: "Passeport", date: "2023-05", expires: "2023-05-20" })).toBeNull();
  });
});
