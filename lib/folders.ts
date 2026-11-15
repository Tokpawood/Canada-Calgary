export interface VaultFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

/** Dossiers proposés à la création (un toucher suffit), à la racine du Coffre. */
export const SUGGESTED_FOLDERS = ["Bulletins", "Diplômes", "Expériences professionnelles", "Reçus de loyer", "Relevés bancaires", "Pièces d'identité", "Photos"];

export function cleanFolderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u001f\\/]/g, " ").replace(/\s+/g, " ").trim();
  return s && s.length <= 80 ? s : null;
}

export function mapFolder(row: Record<string, unknown>): VaultFolder {
  return { id: row.id as string, name: row.name as string, parentId: (row.parent_id as string | null) ?? null, createdAt: row.created_at as string };
}

/** Chaîne des dossiers de la racine jusqu'à `id` inclus (vide si inconnu ; protégé contre les boucles). */
export function folderChain(folders: VaultFolder[], id: string | null): VaultFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: VaultFolder[] = [];
  const seen = new Set<string>();
  let cur = id ? byId.get(id) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

/** « Bulletins › 2023 » */
export function folderPath(folders: VaultFolder[], id: string | null): string | null {
  const chain = folderChain(folders, id);
  return chain.length ? chain.map((f) => f.name).join(" › ") : null;
}

/** Tous les dossiers, triés par chemin, avec leur profondeur (pour les listes de choix). */
export function folderOptions(folders: VaultFolder[]): Array<{ id: string; label: string; depth: number }> {
  return folders
    .map((f) => ({ id: f.id, path: folderChain(folders, f.id) }))
    .map(({ id, path }) => ({ id, label: path.map((f) => f.name).join(" › "), depth: path.length - 1 }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
