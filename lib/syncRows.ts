import type { createClient } from "@/lib/supabase/client";

type Client = ReturnType<typeof createClient>;

/**
 * Écrit en base la différence entre deux versions d'une liste de lignes à identifiant texte :
 * suppressions, insertions (avec position) et mises à jour des seuls champs modifiés.
 */
export async function syncRows<T extends { id: string }>(
  supabase: Client,
  table: string,
  before: T[],
  after: T[],
  toDb: (row: T) => Record<string, unknown>,
  insertExtra: Record<string, unknown>,
): Promise<void> {
  const prev = new Map(before.map((r) => [r.id, r]));
  const keep = new Set(after.map((r) => r.id));
  const removed = before.filter((r) => !keep.has(r.id)).map((r) => r.id);

  if (removed.length) {
    const { error } = await supabase.from(table).delete().in("id", removed);
    if (error) throw error;
  }

  for (const [i, row] of after.entries()) {
    const old = prev.get(row.id);
    const next = toDb(row);
    if (!old) {
      const { error } = await supabase.from(table).insert({ id: row.id, ...insertExtra, ...next, position: i });
      if (error) throw error;
      continue;
    }
    const was = toDb(old);
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(next)) if (JSON.stringify(next[k]) !== JSON.stringify(was[k])) patch[k] = next[k];
    if (Object.keys(patch).length) {
      const { error } = await supabase.from(table).update(patch).eq("id", row.id);
      if (error) throw error;
    }
  }
}
