/**
 * Mini-analyseur Markdown pour l'aide-mémoire : titres, paragraphes, listes, tableaux,
 * citations, séparateurs, gras, italique, barré et code. Produit un arbre de données
 * (aucun HTML brut) que le composant React affiche : un texte collé ne peut pas injecter de balises.
 */

export type Inline = { t: "text"; v: string } | { t: "b" | "i" | "s"; c: Inline[] } | { t: "code"; v: string };

export type Block =
  | { t: "h"; level: 1 | 2 | 3 | 4; c: Inline[]; id: string; text: string }
  | { t: "p"; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "quote"; c: Block[] }
  | { t: "hr" };

const INLINE = /(\*\*(?!\s)[\s\S]+?\*\*|~~(?!\s)[\s\S]+?~~|`[^`]+`|\*(?![\s*])[^*]*?[^\s*]\*|\*(?![\s*])[^*\s]\*)/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ t: "text", v: rest });
      break;
    }
    if (m.index) out.push({ t: "text", v: rest.slice(0, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ t: "b", c: parseInline(tok.slice(2, -2)) });
    else if (tok.startsWith("~~")) out.push({ t: "s", c: parseInline(tok.slice(2, -2)) });
    else if (tok.startsWith("`")) out.push({ t: "code", v: tok.slice(1, -1) });
    else out.push({ t: "i", c: parseInline(tok.slice(1, -1)) });
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

export function plain(c: Inline[]): string {
  return c.map((x) => ("v" in x ? x.v : plain(x.c))).join("");
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "section"
  );
}

const rowCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
const isSep = (line: string) => rowCells(line).every((c) => /^:?-{2,}:?$/.test(c) || !c);
const LIST = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/;

export function parseMarkdown(src: string, used = new Set<string>()): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t || /^<br\s*\/?>$/i.test(t)) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*?)\s*#*$/.exec(t);
    if (h) {
      const c = parseInline(h[2]);
      const text = plain(c);
      let id = slug(text);
      for (let n = 2; used.has(id); n++) id = `${slug(text)}-${n}`;
      used.add(id);
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3 | 4, c, id, text });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (t.startsWith(">")) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) inner.push(lines[i++].trim().replace(/^>\s?/, ""));
      blocks.push({ t: "quote", c: parseMarkdown(inner.join("\n"), used) });
      continue;
    }
    if (t.startsWith("|")) {
      const group: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) group.push(lines[i++]);
      const hasHead = group.length > 1 && isSep(group[1]);
      const head = hasHead ? rowCells(group[0]).map(parseInline) : [];
      const rows = group.slice(hasHead ? 2 : 0).filter((l) => !isSep(l)).map((l) => rowCells(l).map(parseInline));
      blocks.push({ t: "table", head, rows });
      continue;
    }
    const li = LIST.exec(line);
    if (li) {
      const ordered = Boolean(li[1]);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = LIST.exec(lines[i]);
        if (!m || Boolean(m[1]) !== ordered) break;
        let text = m[2];
        i++;
        // Ligne de continuation indentée (sans nouvelle puce).
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !LIST.exec(lines[i])) text += ` ${lines[i++].trim()}`;
        items.push(parseInline(text));
      }
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^(#{1,4}\s|>|\||<br)/i.test(l) || LIST.exec(lines[i]) || /^(-{3,}|\*{3,})$/.test(l)) break;
      para.push(l);
      i++;
    }
    blocks.push({ t: "p", c: parseInline(para.join(" ")) });
  }
  return blocks;
}

/** Titre d'une leçon : le premier titre « # » du texte collé, sinon sa première ligne. */
export function guessTitle(src: string): string {
  const h = /^\s*#{1,2}\s+(.+?)\s*#*$/m.exec(src);
  const first = h?.[1] ?? src.split("\n").find((l) => l.trim())?.trim() ?? "";
  return plain(parseInline(first)).slice(0, 200);
}
