import { describe, expect, it } from "vitest";
import type { DocumentRecord, VaultFile } from "./types";
import { joinUploadErrors, matchesDocQuery, normalizeSearch, obtainedWithPendingChecks, obtainedWithoutScan } from "./documents";
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
  status: "Obtenu",
  use: "",
  from: "",
  date: "",
  notes: "",
  req: "Obligatoire",
  format: "",
  validity: "",
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
      doc({ id: "a", checks: [{ id: "1", text: "x", done: false, position: 0 }] }),
      doc({ id: "b", checks: [{ id: "2", text: "x", done: true, position: 0 }] }),
      doc({ id: "c", status: "À obtenir", checks: [{ id: "3", text: "x", done: false, position: 0 }] }),
    ];
    expect(obtainedWithPendingChecks(docs).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("recherche", () => {
  it("ignore casse et accents", () => {
    expect(normalizeSearch("  Relevé ÉCOLE ")).toBe("releve ecole");
    expect(matchesDocQuery(doc({ name: "Relevé de notes" }), "releve")).toBe(true);
    expect(matchesDocQuery(doc({ from: "Ministère" }), "ministere")).toBe(true);
    expect(matchesDocQuery(doc(), "diplome")).toBe(false);
    expect(matchesDocQuery(doc(), "  ")).toBe(true);
  });
});

describe("messages d'envoi", () => {
  it("regroupe les erreurs", () => {
    expect(joinUploadErrors([])).toBeNull();
    expect(joinUploadErrors(["a", "b"])).toBe("a · b");
    expect(joinUploadErrors(["a", "b", "c", "d", "e"])).toBe("a · b · c · et 2 autre(s) refusé(s).");
  });
});

describe("sauvegarde Drive", () => {
  it("compte les fichiers actifs pas encore copiés sur Drive", () => {
    expect(pendingDriveBackup([file({ id: "1", onDrive: false }), file({ id: "2" }), file({ id: "3", onDrive: false, replacedAt: "x" })]).map((f) => f.id)).toEqual(["1"]);
  });
});
