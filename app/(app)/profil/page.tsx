import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAddressEntries,
  getDocumentsWithDetails,
  getDossierForUser,
  getFsw,
  getGaps,
  getHistoryEntries,
  getIdentity,
  getProfile,
  getSavingsActual,
  getStepsWithDetails,
} from "@/lib/queries";
import { getAccount } from "@/lib/account";
import { ProfilBoard } from "@/components/profil/ProfilBoard";
import { currentEstimates, nclcOf, type TcfTest } from "@/lib/tcf";

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");
  if (dossier.ownerId !== userData.user?.id) redirect("/parcours");

  const [
    account,
    identity,
    profile,
    fsw,
    history,
    addresses,
    steps,
    documents,
    gaps,
    savings,
    { data: tcfRows },
  ] = await Promise.all([
    userData.user
      ? getAccount(supabase, userData.user, dossier.id)
      : Promise.resolve(null),
    getIdentity(supabase, dossier.id),
    getProfile(supabase, dossier.id),
    getFsw(supabase, dossier.id),
    getHistoryEntries(supabase, dossier.id),
    getAddressEntries(supabase, dossier.id),
    getStepsWithDetails(supabase, dossier.id),
    getDocumentsWithDetails(supabase, dossier.id),
    getGaps(supabase, dossier.id),
    getSavingsActual(supabase, dossier.id),
    // Résultats des tests TCF de la Formation, pour estimer le CRS avec le niveau actuel.
    supabase
      .from("tcf_test")
      .select("day, plan, progress")
      .eq("dossier_id", dossier.id)
      .order("day", { ascending: false })
      .limit(30),
  ]);
  const est = currentEstimates(
    (tcfRows ?? []) as Array<Pick<TcfTest, "day" | "plan" | "progress">>,
  );
  const tcfNclc = Object.fromEntries(
    (Object.entries(est) as Array<[keyof typeof est, number]>).map(([e, v]) => [
      e,
      nclcOf(e, v),
    ]),
  ) as Partial<Record<"co" | "ce" | "ee" | "eo", number>>;

  return (
    <ProfilBoard
      dossier={dossier}
      avatarUrl={account?.avatarUrl ?? null}
      initialIdentity={
        identity ?? {
          dossierId: dossier.id,
          nom: "",
          prenoms: "",
          naissance: null,
          lieu: "",
          pere: "",
          mere: "",
          statut: "",
        }
      }
      initialProfile={profile}
      initialFsw={fsw}
      initialHistory={history}
      initialAddresses={addresses}
      tcfNclc={tcfNclc}
      auditSnapshot={{
        steps: steps.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          due: s.due,
        })),
        documents: documents.map((d) => ({
          id: d.id,
          name: d.name,
          expires: d.expires,
          status: d.status,
          checks: d.checks,
          files: d.files,
        })),
        gaps,
        savings,
      }}
    />
  );
}
