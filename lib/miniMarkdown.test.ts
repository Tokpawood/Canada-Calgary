import { describe, expect, it } from "vitest";
import { guessTitle, parseInline, parseMarkdown, plain } from "./miniMarkdown";

describe("mini Markdown de l'aide-mémoire", () => {
  it("lit le gras au milieu d'un mot, le barré et l'italique, sans toucher aux blancs à compléter", () => {
    expect(parseInline("un lieu publi**c**")).toEqual([{ t: "text", v: "un lieu publi" }, { t: "b", c: [{ t: "text", v: "c" }] }]);
    expect(parseInline("~~dans une belle étoile~~")[0]).toMatchObject({ t: "s" });
    expect(parseInline("la *Grammaire progressive*")[1]).toMatchObject({ t: "i" });
    expect(plain(parseInline("Les gares sont des lieux ___ fort___ affluence."))).toBe("Les gares sont des lieux ___ fort___ affluence.");
  });

  it("découpe titres, tableaux, citations et listes", () => {
    const md = `# Leçon de synthèse

## 1. Comment choisir

| Je vois | Préposition |
|---|---|
| **un point** | **à** |

> **Un nom propre → chez.**
> chez Orange, chez Marco.

1. Mon frère travaille ___ Orange.
2. Nous avons dormi ___ belle étoile.

- un lieu publi**c**
<br>
Fin.`;
    const b = parseMarkdown(md);
    expect(b.map((x) => x.t)).toEqual(["h", "h", "table", "quote", "ol", "ul", "p"]);
    expect(b[1]).toMatchObject({ level: 2, id: "1-comment-choisir" });
    expect(b[2]).toMatchObject({ t: "table", rows: [[expect.anything(), expect.anything()]] });
    expect((b[3] as { c: unknown[] }).c).toHaveLength(1);
    expect((b[4] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("devine le titre depuis le premier titre", () => {
    expect(guessTitle("# Leçon de synthèse : prépositions\n\ntexte")).toBe("Leçon de synthèse : prépositions");
    expect(guessTitle("**Note** du jour\nsuite")).toBe("Note du jour");
  });
});
