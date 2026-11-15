import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser } from "@/lib/queries";
import { getFullBundle } from "@/lib/exportData";
import { budgetByPhase } from "@/lib/rules";
import { CONTACT_STAGES } from "@/lib/network";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const dossier = await getDossierForUser(supabase);
  if (!dossier) return NextResponse.json({ error: "Aucun dossier" }, { status: 404 });

  const bundle = await getFullBundle(supabase, dossier);
  const wb = new ExcelJS.Workbook();

  const identity = wb.addWorksheet("Identité et profil");
  identity.addRows([
    ["Nom", bundle.identity.nom],
    ["Prénoms", bundle.identity.prenoms],
    ["Naissance", bundle.identity.naissance ?? ""],
    ["Lieu de naissance", bundle.identity.lieu],
    ["Père", bundle.identity.pere],
    ["Mère", bundle.identity.mere],
    ["Statut", bundle.identity.statut],
    [],
    ["Titre", bundle.profile.titre],
    ["CNP", bundle.profile.cnp],
    ["Nationalité", bundle.profile.nationalite],
    ["Enfants", bundle.profile.enfants],
    ["Passeport", bundle.profile.passeport],
    ["Téléphone", bundle.profile.telephone],
    ["Courriel", bundle.profile.courriel],
    ["Adresse", bundle.profile.adresse],
    ["Programme", bundle.profile.programme],
    ["Ville visée", bundle.profile.ville],
    ["Ville de repli", bundle.profile.repli],
  ]);

  const history = wb.addWorksheet("Historique");
  history.addRow(["Du", "Au", "Type", "Activité", "Organisme", "Lieu", "En parallèle"]);
  bundle.history.forEach((h) => history.addRow([h.from, h.to, h.type, h.activity, h.org, h.place, h.parallel ? "Oui" : "Non"]));

  const addresses = wb.addWorksheet("Adresses");
  addresses.addRow(["Du", "Au", "Adresse", "Ville", "Note"]);
  bundle.addresses.forEach((a) => addresses.addRow([a.from, a.to, a.address, a.city, a.note]));

  const steps = wb.addWorksheet("Étapes");
  steps.addRow(["Phase", "Titre", "Échéance", "Statut", "Prévu", "Payé", "Organisme", "Notes"]);
  bundle.steps.forEach((s) => steps.addRow([s.phase, s.title, s.due ?? "", s.status, s.planned ?? "", s.actual ?? "", s.org, s.notes]));

  const subtasks = wb.addWorksheet("Mini-étapes");
  subtasks.addRow(["Étape", "Mini-étape", "Faite"]);
  bundle.steps.forEach((s) => s.tasks.forEach((t) => subtasks.addRow([s.title, t.text, t.done ? "Oui" : "Non"])));

  const docs = wb.addWorksheet("Documents");
  docs.addRow(["Nom", "Statut", "Caractère", "Format", "Validité", "Sert pour", "Délivré par", "Date"]);
  bundle.documents.forEach((d) => docs.addRow([d.name, d.status, d.req, d.format, d.validity, d.use, d.from, d.date]));

  const checks = wb.addWorksheet("Contrôles documents");
  checks.addRow(["Document", "Contrôle", "Fait"]);
  bundle.documents.forEach((d) => d.checks.forEach((c) => checks.addRow([d.name, c.text, c.done ? "Oui" : "Non"])));

  const links = wb.addWorksheet("Liens officiels");
  links.addRow(["Origine", "Libellé", "Adresse"]);
  bundle.steps.forEach((s) => s.links.forEach((l) => links.addRow([s.title, l.label, l.url])));
  bundle.documents.forEach((d) => d.links.forEach((l) => links.addRow([d.name, l.label, l.url])));

  const budget = wb.addWorksheet("Budget");
  budget.addRow(["Phase", "Prévu", "Payé"]);
  budgetByPhase(bundle.steps).forEach((r) => budget.addRow([r.phase, r.planned, r.actual]));

  const saving = wb.addWorksheet("Épargne");
  saving.addRow(["Libellé", "Prévu", "Réel", "Notes"]);
  bundle.savings.forEach((s) => saving.addRow([s.label, s.planned ?? "", s.actual ?? "", s.notes]));

  const contacts = wb.addWorksheet("Contacts");
  contacts.addRow(["Organisme", "Rôle", "Étape", "Contact", "Équipe", "Prochaine action", "Notes"]);
  bundle.contacts.forEach((c) =>
    contacts.addRow([
      c.org,
      c.role,
      CONTACT_STAGES.find((s) => s.id === c.stage)?.label ?? c.stage,
      c.contact,
      bundle.persons
        .filter((p) => p.contactId === c.id)
        .map((p) => p.name)
        .join(", "),
      c.next,
      c.notes,
    ]),
  );

  const orgName = new Map(bundle.contacts.map((c) => [c.id, c.org]));
  const stepTitle = new Map(bundle.steps.map((s) => [s.id, s.title]));
  const nameOf = new Map(bundle.persons.map((p) => [p.id, p.name]));
  const people = wb.addWorksheet("Réseau");
  people.addRow(["Nom", "Organisme", "Rattachée à", "Fonction", "Ce qu'elle est pour vous", "Téléphone", "WhatsApp", "Courriel", "Site", "Adresse", "Ville", "Pays", "Naissance", "Nationalité", "Pièce", "Numéro", "Tâches liées", "Notes"]);
  bundle.persons.forEach((p) =>
    people.addRow([
      p.name,
      p.contactId ? (orgName.get(p.contactId) ?? "") : "Indépendant",
      p.parentId ? (nameOf.get(p.parentId) ?? "") : "",
      p.title,
      p.relation,
      p.phone,
      p.whatsapp,
      p.email,
      p.website,
      p.address,
      p.city,
      p.country,
      p.birthDate ?? "",
      p.nationality,
      p.idType,
      p.idNumber,
      bundle.contactLinks
        .filter((l) => l.personId === p.id)
        .map((l) => stepTitle.get(l.stepId) ?? "")
        .join(" ; "),
      p.notes,
    ]),
  );

  const gaps = wb.addWorksheet("Écarts à surveiller");
  gaps.addRow(["Écart", "Résolu"]);
  bundle.gaps.forEach((g) => gaps.addRow([g.text, g.done ? "Oui" : "Non"]));

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Dossier_Projet_Canada-${date}.xlsx"`,
    },
  });
}
