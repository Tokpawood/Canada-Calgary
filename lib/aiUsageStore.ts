import type { SupabaseClient } from "@supabase/supabase-js";
import { callCost, type UsageSink } from "./aiUsage";

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
