import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getDossierForUser, getNetwork, getStepsLite } from "@/lib/queries";
import { ContactsBoard } from "@/components/contacts/ContactsBoard";

export default async function ContactsPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [contacts, steps] = await Promise.all([getContacts(supabase, dossier.id), getStepsLite(supabase, dossier.id)]);
  const { persons, links } = await getNetwork(
    supabase,
    contacts.map((c) => c.id),
  );
  return <ContactsBoard dossierId={dossier.id} initialContacts={contacts} initialPersons={persons} initialLinks={links} steps={steps} />;
}
