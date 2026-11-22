/** Comparaison mot à mot (plus longue sous-suite commune) pour montrer ce qui change entre une réponse et sa correction. */
export interface DiffPart {
  text: string;
  type: "same" | "add" | "del";
}

const tokens = (s: string) => s.match(/\S+\s*/g) ?? [];
const key = (t: string) => t.trim().replace(/[’`]/g, "'");

export function wordDiff(from: string, to: string): DiffPart[] {
  const a = tokens(from);
  const b = tokens(to);
  if (a.length * b.length > 40_000) return [...(from ? [{ text: from, type: "del" as const }] : []), ...(to ? [{ text: to, type: "add" as const }] : [])];
  // lcs[i][j] = longueur de la plus longue sous-suite commune de a[i..] et b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = key(a[i]) === key(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, type: DiffPart["type"]) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (key(a[i]) === key(b[j])) {
      push(b[j], "same");
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push(a[i++], "del");
    else push(b[j++], "add");
  }
  while (i < a.length) push(a[i++], "del");
  while (j < b.length) push(b[j++], "add");
  return out;
}

/** Découpe un énoncé à trous (« ___ ») en morceaux de texte entourant les blancs. */
export function splitBlanks(prompt: string): string[] {
  return prompt.split(/_{3,}|…{2,}/);
}
