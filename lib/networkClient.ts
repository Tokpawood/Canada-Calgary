"use client";

import { createClient } from "@/lib/supabase/client";
import { mapContactStep, mapPerson, type ContactPerson, type ContactStepLink } from "./network";

export type PersonDraft = Pick<ContactPerson, "name" | "title" | "email" | "phone" | "notes" | "parentId">;

function fail(error: { code?: string; message: string } | null, fallback: string): never {
  if (error?.code === "23505") throw new Error("Ce lien existe déjà.");
  throw new Error(error?.message && !/violates|permission|policy/i.test(error.message) ? error.message : fallback);
}

export async function addPerson(contactId: string, draft: PersonDraft, position: number): Promise<ContactPerson> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contact_person")
    .insert({ contact_id: contactId, name: draft.name.trim(), title: draft.title.trim(), email: draft.email.trim(), phone: draft.phone.trim(), notes: draft.notes, parent_id: draft.parentId, position })
    .select("*")
    .single();
  if (error || !data) fail(error, "Ajout impossible.");
  return mapPerson(data);
}

export async function updatePerson(id: string, draft: PersonDraft): Promise<ContactPerson> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contact_person")
    .update({ name: draft.name.trim(), title: draft.title.trim(), email: draft.email.trim(), phone: draft.phone.trim(), notes: draft.notes, parent_id: draft.parentId })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail(error, "Enregistrement impossible.");
  return mapPerson(data);
}

/** Supprime une personne ; ses subordonnés remontent sous son propre responsable. */
export async function deletePerson(person: ContactPerson): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase.from("contact_person").update({ parent_id: person.parentId }).eq("parent_id", person.id);
  if (e1) fail(e1, "Suppression impossible.");
  const { error } = await supabase.from("contact_person").delete().eq("id", person.id);
  if (error) fail(error, "Suppression impossible.");
}

export async function linkStep(stepId: string, contactId: string, personId: string | null): Promise<ContactStepLink> {
  const supabase = createClient();
  const { data, error } = await supabase.from("contact_step").insert({ step_id: stepId, contact_id: contactId, person_id: personId }).select("id,step_id,contact_id,person_id").single();
  if (error || !data) fail(error, "Lien impossible.");
  return mapContactStep(data);
}

export async function unlinkStep(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("contact_step").delete().eq("id", id);
  if (error) fail(error, "Suppression du lien impossible.");
}

/** Valeur d'une liste de choix « organisme » ou « organisme › personne ». */
export const targetValue = (contactId: string, personId: string | null) => (personId ? `${contactId}|${personId}` : contactId);
export function parseTarget(v: string): { contactId: string; personId: string | null } | null {
  if (!v) return null;
  const [contactId, personId] = v.split("|");
  return { contactId, personId: personId || null };
}
