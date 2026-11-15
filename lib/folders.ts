export interface VaultFolder {
  id: string;
  name: string;
  createdAt: string;
}

/** Dossiers proposés à la création (un toucher suffit). */
export const SUGGESTED_FOLDERS = ["Bulletins", "Diplômes", "Expériences professionnelles", "Reçus de loyer", "Relevés bancaires", "Pièces d'identité", "Photos"];

export function cleanFolderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u001f\\/]/g, " ").replace(/\s+/g, " ").trim();
  return s && s.length <= 80 ? s : null;
}

export function mapFolder(row: Record<string, unknown>): VaultFolder {
  return { id: row.id as string, name: row.name as string, createdAt: row.created_at as string };
}
