/** Lecture des tests TCF en base (routes serveur). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapTcfRow, type TcfPartRow, type TcfRow, type TcfTest } from "./tcf";

export const tcfToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });

export async function loadTests(
  supabase: SupabaseClient,
  dossierId: string,
  opts: { day?: string; id?: string; limit?: number } = {},
): Promise<TcfTest[]> {
  let q = supabase
    .from("tcf_test")
    .select("id, day, kind, title, plan, sources, progress, summary, status")
    .eq("dossier_id", dossierId);
  if (opts.day) q = q.eq("day", opts.day);
  if (opts.id) q = q.eq("id", opts.id);
  const { data: rows, error } = await q
    .order("day", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (error) throw error;
  if (!rows?.length) return [];
  const { data: parts, error: pErr } = await supabase
    .from("tcf_test_part")
    .select("test_id, idx, status, content, error")
    .in(
      "test_id",
      rows.map((r) => r.id),
    );
  if (pErr) throw pErr;
  return (rows as TcfRow[]).map((r) =>
    mapTcfRow(r, (parts ?? []) as TcfPartRow[]),
  );
}

/** Version complète (avec réponses) d'un test, pour la correction. */
export async function loadFullTest(
  supabase: SupabaseClient,
  dossierId: string,
  id: string,
): Promise<{ row: TcfRow; parts: TcfPartRow[] } | null> {
  const { data: row } = await supabase
    .from("tcf_test")
    .select("id, day, kind, title, plan, sources, progress, summary, status")
    .eq("dossier_id", dossierId)
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;
  const { data: parts } = await supabase
    .from("tcf_test_part")
    .select("test_id, idx, status, content, error")
    .eq("test_id", id);
  return { row: row as TcfRow, parts: (parts ?? []) as TcfPartRow[] };
}
