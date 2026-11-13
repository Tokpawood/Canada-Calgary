"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildImportPlan, rawDossierSchema, type ImportPlan } from "@/lib/import";

const MAX_SIZE = 5 * 1024 * 1024;

type Phase = "idle" | "busy" | "done" | "error";

export default function ImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
    <div className="mx-auto max-w-lg py-10">
      <h1 className="text-2xl font-bold">Importer vos données</h1>
      <p className="mt-2 text-sm text-muted">
        Sélectionnez le fichier <code className="font-mono">etat-complet.json</code> exporté depuis le prototype hors ligne.
        Un import répété remplace les étapes, documents, épargne, contacts, écarts, historique et adresses existants.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="mt-5 block w-full text-sm"
        disabled={phase === "busy"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {phase === "busy" && <p className="mt-4 text-sm text-muted">Import en cours…</p>}
      {phase === "error" && error && <p className="mt-4 text-sm text-bad">{error}</p>}

      {phase === "done" && counts && (
        <div className="mt-5 rounded-lg border border-line bg-surface p-4">
          <p className="font-semibold text-ok">Import terminé.</p>
          <ul className="mt-2 text-sm text-muted">
            <li>{counts.steps} étapes</li>
            <li>{counts.documents} documents</li>
            <li>{counts.history} périodes d&apos;historique</li>
            <li>{counts.addresses} adresses</li>
          </ul>
          <button
            type="button"
            onClick={() => router.replace("/parcours")}
            className="mt-4 rounded-lg bg-act px-4 py-2 text-sm font-semibold text-act-ink"
          >
            Continuer vers le tableau de bord
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
