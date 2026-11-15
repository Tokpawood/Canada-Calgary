import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getDossierForUser, getNetwork, getStepsWithDetails, signPhotos } from "@/lib/queries";
import { ContactsBoard } from "@/components/contacts/ContactsBoard";

export default async function ContactsPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [contacts, steps, { persons, links }] = await Promise.all([getContacts(supabase, dossier.id), getStepsWithDetails(supabase, dossier.id), getNetwork(supabase, dossier.id)]);
  const logos = await signPhotos(
    supabase,
    contacts.map((c) => c.photoPath),
  );
  const withLogos = contacts.map((c) => ({ ...c, photoUrl: c.photoPath ? (logos.get(c.photoPath) ?? null) : null }));
  return <ContactsBoard dossierId={dossier.id} initialContacts={withLogos} initialPersons={persons} initialLinks={links} steps={steps} />;
}
