/** Identifiant texte court pour les lignes créées côté client (étapes, documents, épargne, contacts…). */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function timestamp(): number {
  return Date.now();
}
