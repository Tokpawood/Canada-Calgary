import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("récupération d'image sur internet", () => {
  it("refuse les adresses privées et locales", async () => {
    const { isPrivateIp } = await import("./webImage");
    for (const ip of ["127.0.0.1", "10.2.3.4", "192.168.1.10", "172.20.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "142.250.80.46", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("complète une adresse sans protocole et refuse les autres schémas", async () => {
    const { normalizeUrl } = await import("./webImage");
    expect(normalizeUrl("ircc.gc.ca").href).toBe("https://ircc.gc.ca/");
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow();
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow();
    expect(() => normalizeUrl("https://user:pass@site.com")).toThrow();
  });

  it("préfère l'icône Apple puis l'image de partage, et ignore les SVG", async () => {
    const { imageCandidates } = await import("./webImage");
    const html = `<head>
      <link rel="icon" href="/fav.svg" type="image/svg+xml">
      <meta property="og:image" content="https://cdn.site.com/share.jpg">
      <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
      <link rel="icon" sizes="32x32" href="/f32.png">
    </head>`;
    const list = imageCandidates(html, new URL("https://site.com/fr/accueil")).map((u) => u.href);
    expect(list[0]).toBe("https://site.com/apple.png");
    expect(list[1]).toBe("https://cdn.site.com/share.jpg");
    expect(list.indexOf("https://site.com/fav.svg")).toBeGreaterThan(list.indexOf("https://site.com/f32.png"));
  });
});
