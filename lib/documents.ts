import type { DocumentRecord } from "@/lib/types";

/** Pièces obtenues dont aucun scan actif n'est encore déposé au coffre (à numériser avant le dépôt). */
export function obtainedWithoutScan(docs: DocumentRecord[]): DocumentRecord[] {
  return docs.filter(
    (d) => d.status === "Obtenu" && !d.files.some((f) => !f.replacedAt),
  );
}

/** Pièces obtenues dont au moins un contrôle reste à cocher. */
export function obtainedWithPendingChecks(
  docs: DocumentRecord[],
): DocumentRecord[] {
  return docs.filter(
    (d) => d.status === "Obtenu" && d.checks.some((c) => !c.done),
  );
}

/** Recherche insensible à la casse et aux accents (« reçu » trouve « Recu »). */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function matchesDocQuery(
  d: Pick<DocumentRecord, "name" | "use" | "from" | "notes">,
  query: string,
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(`${d.name} ${d.use} ${d.from} ${d.notes}`).includes(q);
}

/** Regroupe les erreurs d'un envoi multiple en un seul message lisible. */
export function joinUploadErrors(errors: string[], max = 3): string | null {
  if (!errors.length) return null;
  const shown = errors.slice(0, max).join(" · ");
  return errors.length > max
    ? `${shown} · et ${errors.length - max} autre(s) refusé(s).`
    : shown;
}

/** Délai d'alerte avant la fin de validité d'une pièce. */
export const EXPIRY_WARN_DAYS = 90;

export interface ExpiringDoc<T = DocumentRecord> {
  doc: T;
  state: "expired" | "soon";
  /** Jours restants (négatif si expirée). */
  days: number;
}

/** Pièces expirées ou expirant bientôt, les plus urgentes d'abord. */
export function expiringDocs<T extends { expires: string | null }>(
  docs: T[],
  today = new Date(),
  warnDays = EXPIRY_WARN_DAYS,
): ExpiringDoc<T>[] {
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const out: ExpiringDoc<T>[] = [];
  for (const doc of docs) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(doc.expires ?? "");
    if (!m) continue;
    const days = Math.round(
      (Date.UTC(+m[1], +m[2] - 1, +m[3]) - t0) / 86_400_000,
    );
    if (days < 0) out.push({ doc, state: "expired", days });
    else if (days <= warnDays) out.push({ doc, state: "soon", days });
  }
  return out.sort((a, b) => a.days - b.days);
}
