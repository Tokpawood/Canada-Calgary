import { describe, expect, it } from "vitest";
import { sniffMimeType, validateVaultFile, MAX_FILE_SIZE } from "./fileSniff";

function fileFromBytes(bytes: number[], name: string, declaredType: string): File {
  return new File([new Uint8Array(bytes)], name, { type: declaredType });
}

describe("sniffMimeType", () => {
  it("détecte le type réel même si le type déclaré est différent", async () => {
    const pdf = fileFromBytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], "faux.png", "image/png");
    expect(await sniffMimeType(pdf)).toBe("application/pdf");
  });

  it("reconnaît JPEG, PNG et WEBP par signature", async () => {
    const jpeg = fileFromBytes([0xff, 0xd8, 0xff, 0xe0], "a.jpg", "image/jpeg");
    const png = fileFromBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "a.png", "image/png");
    const webp = fileFromBytes(
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      "a.webp",
      "image/webp",
    );
    expect(await sniffMimeType(jpeg)).toBe("image/jpeg");
    expect(await sniffMimeType(png)).toBe("image/png");
    expect(await sniffMimeType(webp)).toBe("image/webp");
  });

  it("retourne null pour un type inconnu", async () => {
    const txt = fileFromBytes([0x68, 0x65, 0x6c, 0x6c, 0x6f], "a.txt", "text/plain");
    expect(await sniffMimeType(txt)).toBeNull();
  });
});

describe("validateVaultFile", () => {
  it("refuse un fichier au-delà de 20 Mo", async () => {
    const big = new File([new Uint8Array(MAX_FILE_SIZE + 1)], "gros.pdf", { type: "application/pdf" });
    const result = await validateVaultFile(big);
    expect(result.ok).toBe(false);
  });

  it("refuse un contenu exécutable déguisé en PDF", async () => {
    const fake = fileFromBytes([0x4d, 0x5a, 0x90, 0x00], "faux.pdf", "application/pdf");
    const result = await validateVaultFile(fake);
    expect(result.ok).toBe(false);
  });

  it("accepte un vrai PDF sous 20 Mo", async () => {
    const real = fileFromBytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], "vrai.pdf", "application/pdf");
    const result = await validateVaultFile(real);
    expect(result).toEqual({ ok: true, mime: "application/pdf" });
  });
});
