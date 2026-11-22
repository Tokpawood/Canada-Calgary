import { describe, expect, it } from "vitest";
import {
  DOCUMENT_STAGES,
  groupByStage,
  guessStage,
  profileReadiness,
  stageOf,
} from "./documentStages";

const d = (
  name: string,
  over: Partial<{
    stage: string;
    req: "Obligatoire" | "Conseillé" | "Si applicable";
    position: number;
  }> = {},
) => ({
  name,
  stage: "",
  req: "Obligatoire" as const,
  position: 0,
  ...over,
});

describe("étapes des documents", () => {
  it("devine l'étape d'après le nom", () => {
    expect(guessStage("Passeport")).toBe("identite");
    expect(guessStage("Extrait d'acte de naissance")).toBe("identite");
    expect(guessStage("Résultats TCF Canada")).toBe("langues");
    expect(guessStage("Diplôme et relevés du Bachelor")).toBe("etudes");
    expect(guessStage("Rapport d'évaluation WES")).toBe("etudes");
    expect(guessStage("Lettre de référence Gandour")).toBe("experience");
    expect(guessStage("Attestation bancaire et relevés de compte")).toBe(
      "fonds",
    );
    expect(guessStage("Casier judiciaire Ghana")).toBe("demande");
    expect(guessStage("Rapport de visite médicale")).toBe("demande");
    expect(guessStage("Relevé d'historique de conduite")).toBe("arrivee");
    expect(guessStage("Confirmation de RP et visa")).toBe("arrivee");
    expect(guessStage("Carte santé de l'Alberta (AHCIP)")).toBe("installation");
    expect(guessStage("Bidule")).toBeNull();
  });

  it("l'étape choisie l'emporte sur le nom", () => {
    expect(
      stageOf(
        d("Attestation — Language World and Computer College (Ghana)", {
          stage: "demande",
        }),
      ),
    ).toBe("demande");
    expect(stageOf(d("Passeport", { stage: "nimporte" }))).toBe("identite");
  });

  it("regroupe dans l'ordre de la procédure, obligatoires d'abord", () => {
    const groups = groupByStage([
      d("Bidule"),
      d("Permis de conduire international", { req: "Conseillé" }),
      d("Passeport", { position: 3 }),
      d("Carte nationale d'identité", { req: "Conseillé", position: 1 }),
      d("Extrait d'acte de naissance", { position: 2 }),
    ]);
    expect(groups.map((g) => g.stage?.id ?? null)).toEqual([
      "identite",
      "arrivee",
      null,
    ]);
    expect(groups[0].docs.map((x) => x.name)).toEqual([
      "Extrait d'acte de naissance",
      "Passeport",
      "Carte nationale d'identité",
    ]);
    expect(DOCUMENT_STAGES).toHaveLength(8);
  });
});

describe("prêt pour le profil", () => {
  it("compte les obligatoires des étapes 1 à 5 et propose d'abord celles à demander", () => {
    const docs = [
      { ...d("Passeport"), status: "Demandé" as const },
      { ...d("Extrait d'acte de naissance"), status: "Obtenu" as const },
      { ...d("Résultats TCF Canada"), status: "À obtenir" as const },
      { ...d("Casier judiciaire Ghana"), status: "À obtenir" as const },
      {
        ...d("Carte nationale d'identité", { req: "Conseillé" }),
        status: "À obtenir" as const,
      },
    ];
    const r = profileReadiness(docs);
    expect(r.total).toBe(3);
    expect(r.done).toBe(1);
    expect(r.next.map((x) => x.name)).toEqual([
      "Résultats TCF Canada",
      "Passeport",
    ]);
  });
});
