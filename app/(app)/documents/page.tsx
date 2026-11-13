import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDocumentsWithDetails, getDossierForUser, getGaps, getIdentity } from "@/lib/queries";
import { DocumentsBoard } from "@/components/documents/DocumentsBoard";
import { DocumentsSidePanel } from "@/components/documents/DocumentsSidePanel";

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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
      <DocumentsBoard initialDocuments={documents} dossierId={dossier.id} />
      <div className="lg:sticky lg:top-4 lg:self-start">
        <DocumentsSidePanel identity={identity} initialGaps={gaps} />
      </div>
    </div>
  );
}
