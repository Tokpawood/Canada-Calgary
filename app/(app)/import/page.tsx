"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildImportPlan, rawDossierSchema, type ImportPlan } from "@/lib/import";
import { PageHeader } from "@/components/ui";
import { FileDropzone } from "@/components/FileDropzone";
import { IconArrowRight, IconCheck, IconInfo } from "@/components/icons";

const MAX_SIZE = 5 * 1024 * 1024;

type Phase = "idle" | "busy" | "done" | "error";

export default function ImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<ImportPlan["counts"] | null>(null);

  async function handleFile(file: File) {
    setPhase("busy");
    setError(null);

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

    const { data: existing } = await supabase.from("dossier").select("id").eq("owner_id", userData.user.id).maybeSingle();

    let dossierId = existing?.id as string | undefined;
    const dossierRow = {
      owner_id: userData.user.id,
      profile_date: parsed.data.profileDate || null,
      funds_min: parsed.data.fundsMin,
      funds_target: parsed.data.fundsTarget,
    };

    if (dossierId) {
      const { error: updateError } = await supabase.from("dossier").update(dossierRow).eq("id", dossierId);
      if (updateError) return fail(updateError.message);
      for (const table of ["step", "document", "saving", "contact", "gap", "history", "address"]) {
        const { error: deleteError } = await supabase.from(table).delete().eq("dossier_id", dossierId);
        if (deleteError) return fail(deleteError.message);
      }
    } else {
      const { data: created, error: insertError } = await supabase.from("dossier").insert(dossierRow).select("id").single();
      if (insertError || !created) return fail(insertError?.message ?? "Création du dossier impossible.");
      dossierId = created.id as string;
    }

    const plan = buildImportPlan(dossierId, parsed.data);

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
      () => insertIfAny(supabase, "gap", plan.gaps),
      () => insertIfAny(supabase, "history", plan.history),
      () => insertIfAny(supabase, "address", plan.addresses),
    ];

    for (const run of steps) {
      const { error: stepError } = await run();
      if (stepError) return fail(stepError.message);
    }

    setCounts(plan.counts);
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

      {phase !== "done" && (
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
        Un nouvel import remplace les étapes, documents, épargne, contacts, écarts, historique et adresses déjà présents. Les scans du coffre ne sont pas touchés.
      </p>

      {phase === "error" && error && <p className="mt-4 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">{error}</p>}

      {phase === "done" && counts && (
        <div className="card anim-fade mt-5 p-5">
          <p className="flex items-center gap-2 font-display text-[18px] font-bold text-ok">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ok text-surface">
              <IconCheck size={15} strokeWidth={3} />
            </span>
            Import terminé
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [counts.steps, "étapes"],
              [counts.documents, "documents"],
              [counts.history, "périodes"],
              [counts.addresses, "adresses"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="mono text-[22px] font-semibold">{n}</dd>
              </div>
            ))}
          </dl>
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

async function insertIfAny(supabase: ReturnType<typeof createClient>, table: string, rows: unknown[]) {
  if (!rows.length) return { error: null };
  return supabase.from(table).insert(rows);
}
