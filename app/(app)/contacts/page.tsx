import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getDossierForUser } from "@/lib/queries";
import { ContactsBoard } from "@/components/contacts/ContactsBoard";

export default async function ContactsPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const contacts = await getContacts(supabase, dossier.id);
  return <ContactsBoard dossierId={dossier.id} initialContacts={contacts} />;
}
