import { describe, expect, it } from "vitest";
import { cleanFolderName } from "./folders";
import { sniffBytes } from "./fileSniff";

describe("dossiers du Coffre", () => {
  it("nettoie les noms et refuse les noms vides ou trop longs", () => {
    expect(cleanFolderName("  Reçus   de loyer ")).toBe("Reçus de loyer");
    expect(cleanFolderName("Bulletins/2024")).toBe("Bulletins 2024");
    expect(cleanFolderName("   ")).toBeNull();
    expect(cleanFolderName("x".repeat(81))).toBeNull();
    expect(cleanFolderName(42)).toBeNull();
  });
});

describe("type réel d'après les premiers octets", () => {
  it("reconnaît PDF, JPEG, PNG, WEBP et refuse le reste", () => {
    expect(sniffBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
    expect(sniffBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(sniffBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(sniffBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    expect(sniffBytes(new Uint8Array())).toBeNull();
  });
});

describe("sous-dossiers", () => {
  const F = (id: string, name: string, parentId: string | null) => ({ id, name, parentId, createdAt: "" });
  const folders = [F("a", "Bulletins", null), F("b", "2023", "a"), F("c", "Trimestre 1", "b"), F("d", "Reçus de loyer", null)];

  it("chemin complet et options triées avec profondeur", async () => {
    const { folderPath, folderOptions, folderChain } = await import("./folders");
    expect(folderPath(folders, "c")).toBe("Bulletins › 2023 › Trimestre 1");
    expect(folderChain(folders, "b").map((f) => f.id)).toEqual(["a", "b"]);
    expect(folderPath(folders, null)).toBeNull();
    expect(folderOptions(folders).map((o) => [o.label, o.depth])).toEqual([
      ["Bulletins", 0],
      ["Bulletins › 2023", 1],
      ["Bulletins › 2023 › Trimestre 1", 2],
      ["Reçus de loyer", 0],
    ]);
  });

  it("résiste à une boucle", async () => {
    const { folderChain } = await import("./folders");
    expect(folderChain([F("x", "X", "y"), F("y", "Y", "x")], "x").length).toBe(2);
  });
});

describe("déplacement d'un dossier", () => {
  const F = (id: string, name: string, parentId: string | null) => ({ id, name, parentId, createdAt: "" });
  const folders = [F("a", "Bulletins", null), F("b", "2023", "a"), F("c", "T1", "b"), F("d", "Reçus", null)];

  it("interdit de mettre un dossier dans lui-même ou dans un de ses sous-dossiers", async () => {
    const { canMoveInto } = await import("./folders");
    expect(canMoveInto(folders, "a", "a")).toBe(false);
    expect(canMoveInto(folders, "a", "c")).toBe(false);
    expect(canMoveInto(folders, "b", "d")).toBe(true);
    expect(canMoveInto(folders, "c", null)).toBe(true);
    expect(canMoveInto(folders, "d", "c")).toBe(true);
    expect(canMoveInto(folders, "d", "inconnu")).toBe(false);
  });
});
