"use client";

import { createClient } from "@/lib/supabase/client";
import { PERSON_COLUMNS, mapContactStep, mapPerson, type ContactPerson, type ContactStepLink, type PersonField } from "./network";
import { squareJpeg } from "./avatarUpload";

const PHOTO_BUCKET = "contact-photos";

export type PersonDraft = Pick<ContactPerson, "name" | "title" | "email" | "phone" | "notes" | "parentId">;

function fail(error: { code?: string; message: string } | null, fallback: string): never {
  if (error?.code === "23505") throw new Error("Ce lien existe déjà.");
  throw new Error(error?.message && !/violates|permission|policy/i.test(error.message) ? error.message : fallback);
}

export async function addPerson(dossierId: string, contactId: string | null, draft: PersonDraft & { relation?: string }, position: number): Promise<ContactPerson> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contact_person")
    .insert({ dossier_id: dossierId, contact_id: contactId, relation: draft.relation?.trim() ?? "", name: draft.name.trim(), title: draft.title.trim(), email: draft.email.trim(), phone: draft.phone.trim(), notes: draft.notes, parent_id: draft.parentId, position })
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

/** Enregistre les champs d'identification modifiés d'une personne. */
export async function patchPerson(id: string, patch: Partial<Pick<ContactPerson, PersonField>>): Promise<void> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) row[PERSON_COLUMNS[k as PersonField]] = typeof v === "string" ? (k === "notes" ? v : v.trim()) || (k === "birthDate" ? null : "") : v;
  if (!Object.keys(row).length) return;
  const { error } = await createClient().from("contact_person").update(row).eq("id", id);
  if (error) fail(error, "Enregistrement impossible.");
}

/** Change l'organisme d'une personne (ou la rend indépendante) : elle quitte l'organigramme, ses tâches la suivent. */
export async function movePerson(person: ContactPerson, contactId: string | null): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase.from("contact_person").update({ parent_id: null }).eq("parent_id", person.id);
  if (e1) fail(e1, "Déplacement impossible.");
  const { error: e2 } = await supabase.from("contact_person").update({ contact_id: contactId, parent_id: null }).eq("id", person.id);
  if (e2) fail(e2, "Déplacement impossible.");
  const { error: e3 } = await supabase.from("contact_step").update({ contact_id: contactId }).eq("person_id", person.id);
  if (e3) fail(e3, "Les tâches liées n'ont pas suivi.");
}

/** Photo d'un organisme ou d'une personne : recadrée au carré dans le navigateur, stockée en privé. Renvoie le chemin et un lien signé. */
export async function uploadPhoto(dossierId: string, kind: "org" | "person", id: string, file: File, oldPath: string | null): Promise<{ path: string; url: string | null }> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) throw new Error("Choisissez une image (JPEG, PNG, HEIC…).");
  if (file.size > 25 * 1024 * 1024) throw new Error("Image trop lourde (25 Mo maximum).");
  let blob: Blob;
  try {
    blob = await squareJpeg(file, kind === "org" ? "contain" : "cover");
  } catch {
    throw new Error("Format d'image non lisible par ce navigateur.");
  }
  const supabase = createClient();
  const path = `${dossierId}/${kind}-${id}-${Date.now().toString(36)}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw new Error("Envoi de la photo impossible.");
  const { error: e2 } = await supabase.from(kind === "org" ? "contact" : "contact_person").update({ photo_path: path }).eq("id", id);
  if (e2) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error("Enregistrement de la photo impossible.");
  }
  if (oldPath) await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return { path, url: data?.signedUrl ?? null };
}

export async function removePhoto(kind: "org" | "person", id: string, path: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(kind === "org" ? "contact" : "contact_person").update({ photo_path: null }).eq("id", id);
  if (error) fail(error, "Suppression impossible.");
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/** Récupère une image sur internet (adresse d'image ou site de l'organisme) côté serveur. */
export async function photoFromWeb(kind: "org" | "person", id: string, url: string): Promise<{ path: string; url: string | null }> {
  const res = await fetch("/api/contacts/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, url }) });
  const body = (await res.json().catch(() => ({}))) as { path?: string; url?: string | null; error?: string };
  if (!res.ok || !body.path) throw new Error(body.error ?? "Récupération impossible.");
  return { path: body.path, url: body.url ?? null };
}

/** Supprime une personne ; ses subordonnés remontent sous son propre responsable. */
export async function deletePerson(person: ContactPerson): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase.from("contact_person").update({ parent_id: person.parentId }).eq("parent_id", person.id);
  if (e1) fail(e1, "Suppression impossible.");
  const { error } = await supabase.from("contact_person").delete().eq("id", person.id);
  if (error) fail(error, "Suppression impossible.");
}

export async function linkStep(stepId: string, contactId: string | null, personId: string | null): Promise<ContactStepLink> {
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
export const targetValue = (contactId: string | null, personId: string | null) => (personId ? `${contactId ?? ""}|${personId}` : (contactId ?? ""));
export function parseTarget(v: string): { contactId: string | null; personId: string | null } | null {
  if (!v) return null;
  const [contactId, personId] = v.split("|");
  return contactId || personId ? { contactId: contactId || null, personId: personId || null } : null;
}
