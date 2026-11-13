export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

const SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
];

function matches(buffer: Uint8Array, bytes: number[]): boolean {
  return bytes.every((b, i) => buffer[i] === b);
}

/** Lit les premiers octets du fichier pour vérifier son type réel (pas seulement l'extension/MIME déclaré). */
export async function sniffMimeType(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  for (const sig of SIGNATURES) {
    if (matches(head, sig.bytes)) return sig.mime;
  }
  // WEBP : "RIFF" (0..3) + taille (4..7) + "WEBP" (8..11)
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
  mime?: string;
}

export async function validateVaultFile(file: File): Promise<FileValidationResult> {
  if (file.size > MAX_FILE_SIZE) return { ok: false, reason: "Fichier trop volumineux (20 Mo maximum)." };
  const mime = await sniffMimeType(file);
  if (!mime || !(ALLOWED_MIME as readonly string[]).includes(mime)) {
    return { ok: false, reason: "Type de fichier non accepté (PDF, JPEG, PNG ou WEBP uniquement)." };
  }
  return { ok: true, mime };
}
