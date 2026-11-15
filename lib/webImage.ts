import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (compatible; ContactPhotoFetcher/1.0)";

export class WebImageError extends Error {}

/** Adresse IP privée, locale ou réservée : jamais interrogée depuis le serveur. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

/** Normalise ce que l'utilisateur colle : « ircc.gc.ca » devient « https://ircc.gc.ca/ ». */
export function normalizeUrl(raw: string): URL {
  const s = raw.trim();
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new WebImageError("Adresse invalide.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new WebImageError("Seules les adresses web (https) sont acceptées.");
  if (u.username || u.password) throw new WebImageError("Adresse invalide.");
  return u;
}

async function assertPublic(u: URL) {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new WebImageError("Adresse non autorisée.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new WebImageError("Site introuvable.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new WebImageError("Adresse non autorisée.");
}

/** GET avec redirections vérifiées une à une, délai et taille plafonnés. */
async function safeFetch(start: URL, accept: string): Promise<{ url: URL; type: string; body: Buffer }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new WebImageError("Redirection refusée.");
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => {
      throw new WebImageError("Le site ne répond pas.");
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new WebImageError("Redirection invalide.");
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok || !res.body) throw new WebImageError(`Le site a répondu ${res.status}.`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new WebImageError("Fichier trop lourd.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new WebImageError("Fichier trop lourd.");
      }
      chunks.push(value);
    }
    return { url, type: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), body: Buffer.concat(chunks) };
  }
  throw new WebImageError("Trop de redirections.");
}

/** Images candidates d'une page : og:image, icônes Apple, puis icônes déclarées (les plus grandes d'abord). */
export function imageCandidates(html: string, base: URL): URL[] {
  const head = html.slice(0, 300_000);
  const out: Array<{ url: string; score: number }> = [];
  const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(2).find((x) => x !== undefined) ?? "";
  for (const tag of head.match(/<(meta|link)\b[^>]*>/gi) ?? []) {
    const lower = tag.toLowerCase();
    if (lower.startsWith("<meta")) {
      const key = (attr(tag, "property") || attr(tag, "name")).toLowerCase();
      if (key === "og:image" || key === "og:image:url" || key === "og:image:secure_url" || key === "twitter:image") out.push({ url: attr(tag, "content"), score: 60 });
    } else {
      const rel = attr(tag, "rel").toLowerCase();
      if (!/icon/.test(rel)) continue;
      const href = attr(tag, "href");
      const size = Number(/(\d+)x\d+/.exec(attr(tag, "sizes"))?.[1] ?? 0);
      const svg = /\.svg(\?|$)/i.test(href) || attr(tag, "type").includes("svg");
      out.push({ url: href, score: (rel.includes("apple-touch") ? 90 : 40) + Math.min(size, 512) / 10 - (svg ? 100 : 0) });
    }
  }
  const seen = new Set<string>();
  return out
    .filter((c) => c.url && !c.url.startsWith("data:"))
    .sort((a, b) => b.score - a.score)
    .map((c) => {
      try {
        return new URL(c.url.replace(/&amp;/g, "&"), base);
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => !!u && !seen.has(u.href) && (seen.add(u.href), true))
    .concat([new URL("/apple-touch-icon.png", base), new URL("/favicon.ico", base)]);
}

/**
 * Récupère une image à partir d'une adresse d'image ou d'un site web, et la renvoie en JPEG carré de 320 px.
 * `contain` garde l'image entière sur fond blanc (logos) ; sinon recadrage au centre (portraits).
 */
export async function fetchWebImage(raw: string, mode: "cover" | "contain"): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const toJpeg = async (buf: Buffer) => {
    const img = sharp(buf, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 16 || meta.height < 16) throw new WebImageError("Image trop petite.");
    return img
      .resize(320, 320, mode === "contain" ? { fit: "contain", background: "#ffffff" } : { fit: "cover", position: "attention" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer();
  };
  const tryImage = async (u: URL) => {
    const r = await safeFetch(u, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8");
    if (r.type.includes("svg") || r.type.startsWith("text/")) throw new WebImageError("Pas une image utilisable.");
    return toJpeg(r.body);
  };

  const first = await safeFetch(normalizeUrl(raw), "text/html,image/*;q=0.9,*/*;q=0.5");
  if (first.type.startsWith("image/") && !first.type.includes("svg")) return toJpeg(first.body);
  if (!first.type.includes("html")) {
    try {
      return await toJpeg(first.body);
    } catch {
      throw new WebImageError("Cette adresse ne mène ni à une image ni à un site.");
    }
  }
  for (const u of imageCandidates(first.body.toString("utf8"), first.url).slice(0, 6)) {
    try {
      return await tryImage(u);
    } catch {
      /* candidate suivante */
    }
  }
  throw new WebImageError("Aucune image trouvée sur ce site : collez plutôt l'adresse d'une image.");
}
