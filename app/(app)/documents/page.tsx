import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDocumentsWithDetails, getDossierForUser, getGaps, getIdentity } from "@/lib/queries";
import { DocumentsBoard } from "@/components/documents/DocumentsBoard";
import { DocumentsSidePanel } from "@/components/documents/DocumentsSidePanel";
import { PageHeader } from "@/components/ui";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [documents, gaps, identity] = await Promise.all([
    getDocumentsWithDetails(supabase, dossier.id),
    getGaps(supabase, dossier.id),
    getIdentity(supabase, dossier.id),
  ]);

  return (
    <>
      <PageHeader title="Documents" description="Pièces à réunir pour le profil et la demande de résidence permanente, avec leurs contrôles avant dépôt et leurs scans." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <DocumentsBoard initialDocuments={documents} dossierId={dossier.id} />
        <div className="xl:sticky xl:top-6 xl:self-start">
          <DocumentsSidePanel identity={identity} initialGaps={gaps} />
        </div>
      </div>
    </>
  );
}
