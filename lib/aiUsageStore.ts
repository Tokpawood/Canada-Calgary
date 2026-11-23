import type { SupabaseClient } from "@supabase/supabase-js";
import { callCost, type UsageRow, type UsageSink } from "./aiUsage";

/** Journal de consommation en base. Une écriture impossible est signalée sans bloquer la préparation. */
export function usageSink(
  supabase: SupabaseClient,
  dossierId: string,
  task: string,
): UsageSink {
  return async (model, u) => {
    try {
      const { error } = await supabase.from("ai_usage").insert({
        dossier_id: dossierId,
        day: new Date().toLocaleDateString("en-CA", {
          timeZone: "Africa/Abidjan",
        }),
        task,
        model,
        input_tokens:
          u.input_tokens +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0),
        output_tokens: u.output_tokens,
        searches: u.server_tool_use?.web_search_requests ?? 0,
        cost_usd: callCost(model, u),
      });
      if (error) console.error("[ia] consommation", error.message);
    } catch (e) {
      console.error("[ia] consommation", e instanceof Error ? e.message : e);
    }
  };
}

/** Tous les appels enregistrés, page par page (l'API en renvoie 1 000 au plus à la fois). */
export async function loadUsage(
  supabase: SupabaseClient,
  dossierId: string,
): Promise<UsageRow[]> {
  const out: UsageRow[] = [];
  for (let from = 0; from < 10_000; from += 1000) {
    const { data, error } = await supabase
      .from("ai_usage")
      .select("day, task, cost_usd")
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (error) {
      console.error("[ia] lecture de la consommation", error.message);
      break;
    }
    for (const r of data ?? [])
      out.push({
        day: r.day as string,
        task: r.task as string,
        cost_usd: Number(r.cost_usd),
      });
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}
