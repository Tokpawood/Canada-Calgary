import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client "clé de service" : contourne les RLS. Réservé aux routes serveur de confiance
 * (ex. cron des rappels). Ne jamais importer depuis un composant client.
 */
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
