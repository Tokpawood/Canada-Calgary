import type { VaultFile } from "@/lib/types";

/** Fichiers actifs dont la copie de sauvegarde sur Google Drive n'est pas encore faite. */
export function pendingDriveBackup(files: VaultFile[]): VaultFile[] {
  return files.filter((f) => !f.replacedAt && !f.onDrive);
}
