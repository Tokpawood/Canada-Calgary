"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<[string, string]> = [
  ["/parcours", "Parcours"],
  ["/profil", "Profil"],
  ["/budget", "Budget"],
  ["/epargne", "Épargne"],
  ["/documents", "Documents"],
  ["/contacts", "Contacts"],
  ["/coffre", "Coffre"],
];

export function TabsNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex w-max max-w-full gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {TABS.map(([href, label]) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              active ? "bg-act text-act-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
