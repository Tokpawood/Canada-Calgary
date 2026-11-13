import { describe, expect, it } from "vitest";
import {
  addressGaps,
  ageAt,
  audit,
  autoFillActual,
  budgetByPhase,
  daysUntil,
  eighteenthBirthdayIso,
  fmtD,
  formatYearsMonths,
  fswCalc,
  FSW_PASS_THRESHOLD,
  fundsProgress,
  gapsOf,
  hostOf,
  historyGaps,
  isLate,
  isOpenStep,
  nextOpenStep,
  nextStatusAfterTaskToggle,
  overallProgress,
  phaseProgress,
  parseD,
  pd,
  safeUrl,
  stepFraction,
  workMonths,
} from "./rules";
import type { FswProfile, HistoryEntry, Saving, Step } from "./types";

const NOW = new Date(2026, 10, 13); // 13 novembre 2026, local

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: "s1",
    dossierId: "d1",
    phase: "1. Mise en ordre",
    title: "Étape",
    due: null,
    status: "À faire",
    planned: null,
    actual: null,
    org: "",
    req: "",
    notes: "",
    risk: "",
    position: 0,
    tasks: [],
    links: [],
    ...overrides,
  };
}

function fsw(overrides: Partial<FswProfile> = {}): FswProfile {
  return {
    dossierId: "d1",
    first: "fr",
    fr_co: "",
    fr_ce: "",
    fr_eo: "",
    fr_ee: "",
    en_co: "",
    en_ce: "",
    en_eo: "",
    en_ee: "",
    edu: "",
    arranged: "0",
    adapt: "0",
    ...overrides,
  };
}

describe("parseD / pd", () => {
  it("parseD exige AAAA-MM-JJ complet", () => {
    expect(parseD("2026-11-13")).not.toBeNull();
    expect(parseD("2026-11")).toBeNull();
    expect(parseD(null)).toBeNull();
    expect(parseD("")).toBeNull();
  });

  it("pd accepte le mois seul et gère début/fin de mois", () => {
    expect(pd("2026-11")?.toISOString()).toBe(new Date(Date.UTC(2026, 10, 1)).toISOString());
    expect(pd("2026-11", true)?.toISOString()).toBe(new Date(Date.UTC(2026, 10, 30)).toISOString());
    expect(pd("2026-02", true)?.toISOString()).toBe(new Date(Date.UTC(2026, 1, 28)).toISOString());
    expect(pd("2026-11-05")?.toISOString()).toBe(new Date(Date.UTC(2026, 10, 5)).toISOString());
    expect(pd("")).toBeNull();
  });
});

describe("retard et avancement des étapes", () => {
  it("une étape Fait ou Si nécessaire n'est jamais en retard", () => {
    expect(isLate(step({ status: "Fait", due: "2020-01-01" }), NOW)).toBe(false);
    expect(isLate(step({ status: "Si nécessaire", due: "2020-01-01" }), NOW)).toBe(false);
  });

  it("une étape ouverte à échéance passée est en retard", () => {
    expect(isLate(step({ status: "À faire", due: "2026-11-01" }), NOW)).toBe(true);
    expect(isLate(step({ status: "Bloqué", due: "2026-11-01" }), NOW)).toBe(true);
    expect(isLate(step({ status: "À faire", due: "2026-12-01" }), NOW)).toBe(false);
  });

  it("isOpenStep exclut seulement Fait et Si nécessaire", () => {
    expect(isOpenStep("Bloqué")).toBe(true);
    expect(isOpenStep("Fait")).toBe(false);
    expect(isOpenStep("Si nécessaire")).toBe(false);
  });

  it("stepFraction : Fait = 1, sinon ratio de mini-étapes", () => {
    expect(stepFraction(step({ status: "Fait" }))).toBe(1);
    expect(stepFraction(step({ status: "En cours", tasks: [] }))).toBe(0);
    expect(
      stepFraction(
        step({
          status: "En cours",
          tasks: [
            { id: "t1", text: "a", done: true, position: 0 },
            { id: "t2", text: "b", done: false, position: 1 },
          ],
        }),
      ),
    ).toBe(0.5);
  });

  it("overallProgress exclut les étapes Si nécessaire", () => {
    const steps = [step({ status: "Fait" }), step({ status: "Si nécessaire" }), step({ status: "À faire", tasks: [] })];
    expect(overallProgress(steps)).toBe(0.5);
  });

  it("phaseProgress agrège par phase dans l'ordre d'apparition", () => {
    const steps = [
      step({ phase: "1. Mise en ordre", status: "Fait" }),
      step({ phase: "2. Tests", status: "À faire", tasks: [] }),
      step({ phase: "1. Mise en ordre", status: "À faire", tasks: [] }),
    ];
    expect(phaseProgress(steps)).toEqual([
      { phase: "1. Mise en ordre", pct: 50 },
      { phase: "2. Tests", pct: 0 },
    ]);
  });

  it("transitions automatiques de statut", () => {
    expect(nextStatusAfterTaskToggle("À faire", 1, 3)).toBe("En cours");
    expect(nextStatusAfterTaskToggle("En cours", 3, 3)).toBe("Fait");
    expect(nextStatusAfterTaskToggle("Fait", 2, 3)).toBe("En cours");
    expect(nextStatusAfterTaskToggle("Bloqué", 0, 3)).toBe("Bloqué");
  });

  it("autoFillActual remplit actual=planned seulement en passant à Fait avec actual vide", () => {
    expect(autoFillActual({ planned: 1000, actual: null }, "Fait")).toBe(1000);
    expect(autoFillActual({ planned: 1000, actual: 500 }, "Fait")).toBe(500);
    expect(autoFillActual({ planned: 1000, actual: null }, "En cours")).toBeNull();
  });
});

describe("nextOpenStep", () => {
  it("choisit l'échéance la plus proche parmi les étapes ouvertes", () => {
    const steps = [
      step({ id: "a", status: "Fait", due: "2026-11-14" }),
      step({ id: "b", status: "À faire", due: "2026-12-01" }),
      step({ id: "c", status: "À faire", due: "2026-11-20" }),
      step({ id: "d", status: "Si nécessaire", due: "2026-11-15" }),
    ];
    expect(nextOpenStep(steps, NOW)?.id).toBe("c");
  });

  it("retombe sur la première étape ouverte sans échéance s'il n'y en a aucune datée", () => {
    const steps = [step({ id: "a", status: "À faire", due: null }), step({ id: "b", status: "En cours", due: null })];
    expect(nextOpenStep(steps, NOW)?.id).toBe("a");
  });

  it("retourne null s'il n'y a plus d'étape ouverte", () => {
    expect(nextOpenStep([step({ status: "Fait" })], NOW)).toBeNull();
  });
});

describe("gapsOf", () => {
  it("signale un trou de plus de 4 jours mais pas un de 3 jours", () => {
    const rowsBigGap = [
      { from: "2020-01-01", to: "2020-01-10", parallel: false },
      { from: "2020-01-16", to: "2020-02-01", parallel: false }, // trou du 11 au 15 = 5 jours
    ];
    expect(gapsOf(rowsBigGap, "2020-01-01", () => "ligne", new Date(2020, 1, 2))).toHaveLength(1);

    const rowsSmallGap = [
      { from: "2020-01-01", to: "2020-01-10", parallel: false },
      { from: "2020-01-14", to: "2020-02-01", parallel: false }, // trou du 11 au 13 = 3 jours
    ];
    expect(gapsOf(rowsSmallGap, "2020-01-01", () => "ligne", new Date(2020, 1, 2))).toHaveLength(0);
  });

  it("ignore les lignes en parallèle pour la détection", () => {
    const rows = [
      { from: "2020-01-01", to: "2020-01-10", parallel: false },
      { from: "2020-01-05", to: "2020-01-08", parallel: true },
      { from: "2020-01-11", to: "2020-02-01", parallel: false },
    ];
    expect(gapsOf(rows, "2020-01-01", () => "ligne", new Date(2020, 1, 2))).toHaveLength(0);
  });

  it("historyGaps/addressGaps dérivent le point de départ de la date de naissance + 18 ans", () => {
    const history: Array<Pick<HistoryEntry, "from" | "to" | "parallel" | "activity">> = [
      { from: "2018-08-22", to: "2020-01-01", parallel: false, activity: "Études" },
    ];
    expect(historyGaps(history, "2000-08-22", new Date(2020, 0, 2))).toHaveLength(0);
    expect(addressGaps([], "2000-08-22", new Date(2020, 0, 2))[0]).toMatch(/Rien de déclaré/);
  });
});

describe("workMonths", () => {
  it("ne compte que les périodes de type Travail, en mois de 30,4375 jours", () => {
    const history: Array<Pick<HistoryEntry, "type" | "from" | "to">> = [
      { type: "Travail", from: "2024-01-01", to: "2025-01-01" },
      { type: "Études", from: "2020-01-01", to: "2023-01-01" },
    ];
    const months = workMonths(history, "2025-01-01");
    expect(months).toBeCloseTo(366 / 30.4375, 2); // 2024 est bissextile
  });

  it("formatYearsMonths affiche les mois seuls sous un an", () => {
    expect(formatYearsMonths(7)).toBe("7 mois");
    expect(formatYearsMonths(24)).toBe("2 ans");
    expect(formatYearsMonths(25)).toBe("2 ans 1 mois");
  });
});

describe("fswCalc", () => {
  it("non admissible si une épreuve de 1re langue est sous 7, même grille complète par ailleurs", () => {
    const r = fswCalc(
      fsw({ fr_co: "9", fr_ce: "9", fr_eo: "6", fr_ee: "9", edu: "p3", arranged: "10", adapt: "10" }),
      "2000-01-01",
      "2026-01-01",
      [],
      NOW,
    );
    expect(r.below).toBe(true);
    expect(r.status).toBe("Non admissible");
  });

  it("à compléter si la grille de 1re langue n'est pas entièrement saisie", () => {
    const r = fswCalc(fsw({ fr_co: "9", edu: "p3" }), "2000-01-01", "2026-01-01", [], NOW);
    expect(r.known).toBe(false);
    expect(r.status).toBe("À compléter");
  });

  it("admissible au-dessus du seuil de 67, avec le détail des points", () => {
    const history: Array<Pick<HistoryEntry, "type" | "from" | "to">> = [{ type: "Travail", from: "2015-01-01", to: "2025-12-01" }];
    const r = fswCalc(
      fsw({ fr_co: "9", fr_ce: "9", fr_eo: "9", fr_ee: "9", en_co: "6", en_ce: "6", en_eo: "6", en_ee: "6", edu: "p3", arranged: "0", adapt: "10" }),
      "2000-08-22",
      "2027-05-31",
      history,
      NOW,
    );
    expect(r.l1).toBe(24);
    expect(r.l2).toBe(4);
    expect(r.ed).toBe(21);
    expect(r.ex).toBe(15);
    expect(r.ag).toBe(12);
    expect(r.ae).toBe(0);
    expect(r.ad).toBe(10);
    expect(r.total).toBe(86);
    expect(r.status).toBe("Admissible");
    expect(r.margin).toBe(86 - FSW_PASS_THRESHOLD);
  });

  it("l'âge décroît d'un point par an entre 36 et 46 ans, 0 dès 47 ans", () => {
    expect(ageAt("1990-01-01", "2026-01-01")).toBe(36);
  });
});

describe("audit", () => {
  it("classe une étape en retard en Bloquant et trie par niveau", () => {
    const items = audit(
      {
        steps: [step({ id: "late", title: "Retard", status: "À faire", due: "2026-11-01" })],
        documents: [],
        gaps: [{ id: "g1", text: "écart", done: false }],
        identity: { nom: "X" },
        profile: {},
        history: [],
        addresses: [],
        savings: [{ actual: 0 }],
        fsw: fswCalc(fsw(), null, null, [], NOW),
      },
      NOW,
    );
    expect(items[0].level).toBe("hi");
    expect(items.some((i) => i.level === "md")).toBe(true);
    expect(items.some((i) => i.level === "lo")).toBe(true);
  });

  it("rien à signaler quand tout est en ordre", () => {
    const fswOk = fswCalc(
      fsw({ fr_co: "9", fr_ce: "9", fr_eo: "9", fr_ee: "9", en_co: "6", en_ce: "6", en_eo: "6", en_ee: "6", edu: "p3", adapt: "10" }),
      "1995-01-01",
      "2027-01-01",
      [{ type: "Travail", from: "2015-01-01", to: "2026-01-01" }],
      NOW,
    );
    const items = audit(
      {
        steps: [],
        documents: [],
        gaps: [],
        identity: { nom: "A", prenoms: "B", naissance: "1995-01-01", lieu: "C", pere: "D", mere: "E" },
        profile: { passeport: "X", telephone: "Y", courriel: "Z" },
        history: [{ from: "2013-01-01", to: "", parallel: false, activity: "Continu", org: "", place: "" }],
        addresses: [{ from: "2013-01-01", to: "", parallel: false, address: "Continu" }],
        savings: [{ actual: 1 }],
        fsw: fswOk,
      },
      NOW,
    );
    expect(items).toHaveLength(0);
  });
});

describe("budgetByPhase et fundsProgress", () => {
  it("agrège prévu/réel par phase dans l'ordre d'apparition", () => {
    const steps = [
      step({ phase: "1. Mise en ordre", planned: 100, actual: 100 }),
      step({ phase: "2. Tests", planned: 200, actual: 0 }),
      step({ phase: "1. Mise en ordre", planned: 50, actual: 50 }),
    ];
    expect(budgetByPhase(steps)).toEqual([
      { phase: "1. Mise en ordre", planned: 150, actual: 150 },
      { phase: "2. Tests", planned: 200, actual: 0 },
    ]);
  });

  it("fundsProgress plafonne à 100% et repère le minimum exigé", () => {
    const savings: Array<Pick<Saving, "actual">> = [{ actual: 4000000 }, { actual: 3000000 }];
    const p = fundsProgress(savings, { fundsMin: 6258000, fundsTarget: 7000000 });
    expect(p.saved).toBe(7000000);
    expect(p.pctOfTarget).toBe(100);
    expect(p.minReached).toBe(true);
    expect(p.targetReached).toBe(true);
  });
});

describe("safeUrl / hostOf", () => {
  it("n'accepte que les adresses https valides", () => {
    expect(safeUrl("https://exemple.ca/page")).toBe("https://exemple.ca/page");
    expect(safeUrl("http://exemple.ca")).toBeNull();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("  ")).toBeNull();
  });

  it("extrait le nom de domaine sans www", () => {
    expect(hostOf("https://www.exemple.ca/page")).toBe("exemple.ca");
  });
});

describe("divers utilitaires", () => {
  it("fmtD formate en JJ/MM/AAAA", () => {
    expect(fmtD(new Date(Date.UTC(2026, 10, 13)))).toBe("13/11/2026");
  });

  it("eighteenthBirthdayIso ajoute 18 ans à la date de naissance", () => {
    expect(eighteenthBirthdayIso("2000-08-22")).toBe("2018-08-22");
    expect(eighteenthBirthdayIso(null)).toBeNull();
  });

  it("daysUntil retourne null sans échéance et un entier signé sinon", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("2026-11-20", NOW)).toBe(7);
    expect(daysUntil("2026-11-06", NOW)).toBe(-7);
  });
});
