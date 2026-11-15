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
