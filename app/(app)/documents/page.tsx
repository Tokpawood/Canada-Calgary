import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDocumentsWithDetails, getDossierForUser, getGaps, getIdentity } from "@/lib/queries";
import { DocumentsBoard } from "@/components/documents/DocumentsBoard";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [documents, gaps, identity] = await Promise.all([
    getDocumentsWithDetails(supabase, dossier.id),
    getGaps(supabase, dossier.id),
    getIdentity(supabase, dossier.id),
  ]);

  return <DocumentsBoard initialDocuments={documents} dossierId={dossier.id} identity={identity} initialGaps={gaps} />;
}
