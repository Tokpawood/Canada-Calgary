"use client";

import Link from "next/link";
import { useState } from "react";
import { AUDIT_LEVEL_LABEL, type AuditItem } from "@/lib/rules";
import { IconAlert, IconCheck, IconChevronRight } from "./icons";
import type { Tone } from "./ui";
import { TONE_CLASS, TONE_DOT } from "./ui";

const LEVEL_TONE: Record<AuditItem["level"], Tone> = { hi: "bad", md: "opt", lo: "todo" };
const LEVELS: AuditItem["level"][] = ["hi", "md", "lo"];

export function AuditPanel({ items, limit = 6 }: { items: AuditItem[]; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3.5">
        <div className="flex items-center gap-2">
          <IconAlert size={16} className={items.some((i) => i.level === "hi") ? "text-bad" : "text-muted"} />
          <h2 className="text-[14px] font-bold">Contrôle du dossier</h2>
        </div>
        {items.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {LEVELS.map((l) => {
              const n = items.filter((i) => i.level === l).length;
              if (!n) return null;
              return (
                <span key={l} className={`chip ${TONE_CLASS[LEVEL_TONE[l]]}`}>
                  <span className="mono">{n}</span> {AUDIT_LEVEL_LABEL[l].toLowerCase()}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-4 text-[13.5px] font-semibold text-ok">
          <IconCheck size={16} />
          Rien à signaler.
        </div>
      ) : (
        <ul>
          {shown.map((item, i) => (
            <li key={i} className="border-t border-line first:border-t-0">
              <Link href={`/${item.goto}`} className="group flex items-start gap-2.5 px-4 py-2.5 hover:bg-surface-2/70">
                <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${TONE_DOT[LEVEL_TONE[item.level]]}`} title={AUDIT_LEVEL_LABEL[item.level]} />
                <span className="flex-1 text-[13px] leading-snug">
                  <span className="sr-only">{AUDIT_LEVEL_LABEL[item.level]} : </span>
                  {item.text}
                </span>
                <IconChevronRight size={14} className="mt-0.5 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {items.length > limit && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full border-t border-line px-4 py-2.5 text-[12.5px] font-semibold text-act hover:bg-surface-2/70">
          {expanded ? "Réduire" : `Voir les ${items.length - limit} autre(s) point(s)`}
        </button>
      )}
    </section>
  );
}
