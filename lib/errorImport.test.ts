import { describe, expect, it } from "vitest";
import { errorKey, parseCorrections } from "./errorImport";

describe("import de corrections", () => {
  it("lit un tableau Markdown et ignore l'en-tête et le séparateur", () => {
    const md = `| Vous avez écrit | Correction | Type |
|---|---|---|
| en qui concerne | en **ce** qui concerne | Expression figée |
| lieux **a fort** affluence | lieux **à forte** affluence | Accent, et accord : « affluence » est féminin |`;
    expect(parseCorrections(md)).toEqual([
      { wrong: "en qui concerne", correct: "en ce qui concerne", rule: "Expression figée" },
      { wrong: "lieux a fort affluence", correct: "lieux à forte affluence", rule: "Accent, et accord : « affluence » est féminin" },
    ]);
  });

  it("lit un tableau copié depuis une page (tabulations)", () => {
    const tsv = "Vous avez écrit\tCorrection\tType\ndonnera\tcréerait\tHypothèse, donc conditionnel\n";
    expect(parseCorrections(tsv)).toEqual([{ wrong: "donnera", correct: "créerait", rule: "Hypothèse, donc conditionnel" }]);
  });

  it("garde les astérisques qui ne sont pas de la mise en forme et ignore le texte libre", () => {
    const md = "Voici mes notes.\n| de comment **ils** sont utilisés | de **la manière dont elles** sont utilisé**es** | Familier |";
    expect(parseCorrections(md)[0]).toEqual({ wrong: "de comment ils sont utilisés", correct: "de la manière dont elles sont utilisées", rule: "Familier" });
    expect(parseCorrections("pas de tableau ici")).toEqual([]);
  });

  it("ignore les tableaux qui ne sont pas des corrections (scores, bilans)", () => {
    const md = `**Note : 17/20**

| Exercice | 1er essai | Reprise |
|---|---|---|
| 1. Dans ou sur | 4/6 | **6/6** |

| Vous avez écrit | Correction | Pourquoi |
|---|---|---|
| à Esso (ex. 4) | **chez** Esso | Chez + entreprise ou marque |`;
    expect(parseCorrections(md)).toEqual([{ wrong: "à Esso (ex. 4)", correct: "chez Esso", rule: "Chez + entreprise ou marque" }]);
  });

  it("compare les fautes sans accents ni ponctuation", () => {
    expect(errorKey("Lieux publiques !")).toBe(errorKey("lieux publiques"));
    expect(errorKey("à forte")).toBe("a forte");
  });
});
