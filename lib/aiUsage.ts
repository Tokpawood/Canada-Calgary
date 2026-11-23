/** Consommation de l'API Claude : prix estimé d'un appel et causes d'échec. Aucune entrée/sortie. */

/** Rédaction (questions, exercices) à coût réduit ; correction sur le modèle le plus précis. */
export const WRITING_MODEL = "claude-sonnet-5-5";
export const GRADING_MODEL = "claude-opus-5-5";

/** Tarifs publics en dollars par million de jetons. Une recherche web coûte 10 $ les 1 000. */
const OPUS = { in: 4, out: 20, cacheRead: 0.2 };
const SONNET = { in: 2, out: 10, cacheRead: 0.1 };
const SEARCH_PRICE = 0.01;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/** Coût estimé en dollars (modèle inconnu : compté au tarif d'Opus). */
export function callCost(model: string, u: TokenUsage): number {
  const p = /sonnet-5/.test(model) ? SONNET : OPUS;
  return (
    (u.input_tokens * p.in +
      (u.cache_creation_input_tokens ?? 0) * p.in * 1.25 +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      u.output_tokens * p.out) /
      1_000_000 +
    (u.server_tool_use?.web_search_requests ?? 0) * SEARCH_PRICE
  );
}

/** Enregistre un appel ; ne doit jamais faire échouer l'appel lui-même. */
export type UsageSink = (model: string, usage: TokenUsage) => Promise<void>;

const CREDIT_TEXT =
  "Le crédit de l'API Claude est épuisé ou son plafond est atteint : rechargez-le sur platform.claude.com (Billing), puis réessayez.";
const KEY_TEXT =
  "La clé API Anthropic est refusée : vérifiez-la dans les réglages Vercel.";

/** Cause précise d'une erreur de l'API : crédit, accès, attente ou panne ne se règlent pas de la même façon. */
export function apiErrorText(e: { status?: number; message: string }): string {
  if (
    e.status === 402 ||
    /credit balance|billing|usage limits?/i.test(e.message)
  )
    return CREDIT_TEXT;
  if (e.status === 401) return KEY_TEXT;
  if (e.status === 403 || e.status === 404)
    return `La clé API n'a pas accès au modèle demandé (code ${e.status}).`;
  if (e.status === undefined)
    return "Claude n'a pas répondu à temps. Réessayez dans quelques minutes.";
  if (e.status >= 500)
    return `Claude est surchargé ou en panne (code ${e.status}). Réessayez dans quelques minutes.`;
  return `Claude a rejeté la demande (code ${e.status}).`;
}

/** Inutile de relancer tant que rien n'a changé du côté du compte : crédit épuisé ou clé refusée. */
export const isAccountError = (msg: string | null | undefined) =>
  msg === CREDIT_TEXT || msg === KEY_TEXT;

/** Durée de réutilisation d'une recherche internet. */
export const RESEARCH_REUSE_DAYS = 3;

export function canReuseResearch(origin: string, today: string): boolean {
  const d =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${origin}T00:00:00Z`)) /
    86_400_000;
  return d >= 0 && d < RESEARCH_REUSE_DAYS;
}

/** Budget mensuel (dollars), taux indicatif du dollar en FCFA. */
export const AI_BUDGET = 25;
export const USD_TO_XOF = 600;

export interface UsageRow {
  day: string;
  task: string;
  cost_usd: number;
}

export function usageTotals(rows: UsageRow[], today: string) {
  const sum = (l: UsageRow[]) => l.reduce((t, r) => t + r.cost_usd, 0);
  const inMonth = rows.filter((r) => r.day.slice(0, 7) === today.slice(0, 7));
  const month = sum(inMonth);
  return {
    today: sum(rows.filter((r) => r.day === today)),
    month,
  };
}
