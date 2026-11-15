"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildImportPlan, rawDossierSchema, type ImportPlan, type RawDossier } from "@/lib/import";
import { PageHeader } from "@/components/ui";
import { FileDropzone } from "@/components/FileDropzone";
import { IconAlert, IconArrowRight, IconCheck, IconDownload, IconInfo } from "@/components/icons";

const MAX_SIZE = 5 * 1024 * 1024;

type Phase = "idle" | "busy" | "confirm" | "done" | "error";

/** Fichier lu et validé, en attente de confirmation car il remplacera un dossier existant. */
interface Pending {
  name: string;
  data: RawDossier;
  counts: ImportPlan["counts"];
  existingId: string;
  userId: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<ImportPlan["counts"] | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  async function handleFile(file: File) {
    setPhase("busy");
    setError(null);
    setPending(null);

    if (file.size > MAX_SIZE) {
      setPhase("error");
      setError("Fichier trop volumineux (5 Mo maximum).");
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setPhase("error");
      setError("Ce fichier n'est pas un JSON valide.");
      return;
    }

    const parsed = rawDossierSchema.safeParse(json);
    if (!parsed.success) {
      setPhase("error");
      setError(`Le fichier ne correspond pas au format attendu : ${parsed.error.issues[0]?.message ?? "champ manquant"}.`);
      return;
    }

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setPhase("error");
      setError("Session expirée, reconnectez-vous.");
      return;
    }

    const { data: existing, error: lookupError } = await supabase.from("dossier").select("id").eq("owner_id", userData.user.id).maybeSingle();
    if (lookupError) return fail(`Lecture du dossier impossible : ${lookupError.message}`);

    if (existing?.id) {
      // Un dossier existe : on montre ce qui sera importé et on demande confirmation avant de remplacer.
      setPending({ name: file.name, data: parsed.data, counts: buildImportPlan(existing.id as string, parsed.data).counts, existingId: existing.id as string, userId: userData.user.id });
      setPhase("confirm");
      return;
    }
    await runImport(parsed.data, userData.user.id, undefined);
  }

  async function runImport(data: RawDossier, userId: string, existingId: string | undefined) {
    setPhase("busy");
    setError(null);
    const supabase = createClient();
    const failWrite = (msg: string) => fail(`${msg} — l'écriture s'est interrompue, le dossier peut être incomplet : relancez l'import avec le même fichier.`);
    let dossierId = existingId;
    const dossierRow = {
      owner_id: userId,
      profile_date: data.profileDate || null,
      funds_min: data.fundsMin,
      funds_target: data.fundsTarget,
    };

    if (dossierId) {
      const { error: updateError } = await supabase.from("dossier").update(dossierRow).eq("id", dossierId);
      if (updateError) return failWrite(updateError.message);
      for (const table of ["step", "document", "saving", "contact_person", "contact", "gap", "history", "address"]) {
        const { error: deleteError } = await supabase.from(table).delete().eq("dossier_id", dossierId);
        if (deleteError) return failWrite(deleteError.message);
      }
    } else {
      const { data: created, error: insertError } = await supabase.from("dossier").insert(dossierRow).select("id").single();
      if (insertError || !created) return failWrite(insertError?.message ?? "Création du dossier impossible.");
      dossierId = created.id as string;
    }

    const plan = buildImportPlan(dossierId, data);

    const steps = [
      () => supabase.from("identity").upsert({ dossier_id: dossierId, ...plan.identity }, { onConflict: "dossier_id" }),
      () => supabase.from("profile").upsert({ dossier_id: dossierId, ...plan.profile }, { onConflict: "dossier_id" }),
      () => supabase.from("fsw").upsert({ dossier_id: dossierId, ...plan.fsw }, { onConflict: "dossier_id" }),
      () => insertIfAny(supabase, "step", plan.steps),
      () => insertIfAny(supabase, "step_task", plan.stepTasks),
      () => insertIfAny(supabase, "step_link", plan.stepLinks),
      () => insertIfAny(supabase, "document", plan.documents),
      () => insertIfAny(supabase, "document_check", plan.documentChecks),
      () => insertIfAny(supabase, "document_link", plan.documentLinks),
      () => insertIfAny(supabase, "saving", plan.savings),
      () => insertIfAny(supabase, "contact", plan.contacts),
      ...plan.peopleLevels.map((level) => () => insertIfAny(supabase, "contact_person", level)),
      () => insertIfAny(supabase, "contact_person_private", plan.peoplePrivate),
      () => insertIfAny(supabase, "contact_step", plan.contactLinks),
      () => insertIfAny(supabase, "gap", plan.gaps),
      () => insertIfAny(supabase, "history", plan.history),
      () => insertIfAny(supabase, "address", plan.addresses),
    ];

    for (const run of steps) {
      const { error: stepError } = await run();
      if (stepError) return failWrite(stepError.message);
    }

    setCounts(plan.counts);
    setPending(null);
    setPhase("done");
  }

  function fail(msg: string) {
    setPhase("error");
    setError(msg);
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Importer vos données"
        description={
          <>
            Fichier <code className="mono">etat-complet.json</code> exporté depuis le prototype hors ligne, ou depuis l&apos;export JSON de cette application.
          </>
        }
      />

      {phase !== "done" && phase !== "confirm" && (
        <FileDropzone
          multiple={false}
          accept="application/json,.json"
          busy={phase === "busy"}
          title="Déposez le fichier JSON ici"
          hint="5 Mo maximum"
          onFiles={(files) => {
            const file = files[0];
            if (file) void handleFile(file);
          }}
        />
      )}

      <p className="mt-3 flex items-start gap-2 text-[12.5px] text-muted">
        <IconInfo size={15} className="mt-px shrink-0" />
        Un nouvel import remplace les étapes, documents, épargne, contacts (organismes, personnes et liens), écarts, historique et adresses déjà présents. Les scans du coffre ne sont pas touchés.
      </p>

      {phase === "confirm" && pending && (
        <div className="card anim-fade p-5" role="alertdialog" aria-labelledby="import-confirm-title" aria-describedby="import-confirm-desc">
          <p id="import-confirm-title" className="flex items-center gap-2 font-display text-[17px] font-bold">
            <IconAlert size={18} className="shrink-0 text-opt" /> Remplacer les données actuelles ?
          </p>
          <p id="import-confirm-desc" className="mt-1.5 text-[13px] text-muted">
            <span className="mono break-all">{pending.name}</span> est valide. Son import effacera les données actuelles du dossier (hors scans du coffre) pour les remplacer par :
          </p>
          <ImportCounts counts={pending.counts} />
          <a href="/api/export/json" className="btn btn-ghost btn-sm mt-4">
            <IconDownload size={14} /> Télécharger d&apos;abord une sauvegarde JSON
          </a>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void runImport(pending.data, pending.userId, pending.existingId)} className="btn btn-danger py-2.5">
              Remplacer par ce fichier
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setPhase("idle");
              }}
              className="btn btn-ghost py-2.5"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {phase === "error" && error && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}

      {phase === "done" && counts && (
        <div className="card anim-fade mt-5 p-5">
          <p className="flex items-center gap-2 font-display text-[18px] font-bold text-ok">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ok text-surface">
              <IconCheck size={15} strokeWidth={3} />
            </span>
            Import terminé
          </p>
          <ImportCounts counts={counts} />
          <button
            type="button"
            onClick={() => {
              router.replace("/parcours");
              router.refresh();
            }}
            className="btn btn-primary mt-5 w-full py-2.5"
          >
            Ouvrir le tableau de bord <IconArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function ImportCounts({ counts }: { counts: ImportPlan["counts"] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(
        [
          [counts.steps, "étapes"],
          [counts.documents, "documents"],
          [counts.history, "périodes"],
          [counts.addresses, "adresses"],
        ] as const
      ).map(([n, label]) => (
        <div key={label} className="rounded-xl bg-surface-2 px-3 py-2.5">
          <dt className="text-[12px] text-muted">{label}</dt>
          <dd className="mono text-[22px] font-semibold">{n}</dd>
        </div>
      ))}
    </dl>
  );
}

async function insertIfAny(supabase: ReturnType<typeof createClient>, table: string, rows: unknown[]) {
  if (!rows.length) return { error: null };
  return supabase.from(table).insert(rows);
}
