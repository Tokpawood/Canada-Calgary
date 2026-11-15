import { safeUrl } from "@/lib/rules";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d][\d\s().-]{6,}$/;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

/** Lien cliquable pour un courriel, un téléphone ou un site ; null si la valeur n'en est pas un. */
export function contactLink(raw: string): { href: string; kind: "mail" | "phone" | "web" } | null {
  const v = raw.trim();
  if (EMAIL_RE.test(v)) return { href: `mailto:${v}`, kind: "mail" };
  if (PHONE_RE.test(v)) return { href: `tel:${v.replace(/[^\d+]/g, "")}`, kind: "phone" };
  const url = safeUrl(v) ?? (DOMAIN_RE.test(v) ? safeUrl(`https://${v}`) : null);
  return url ? { href: url, kind: "web" } : null;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
