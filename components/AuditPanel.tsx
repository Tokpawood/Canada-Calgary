import Link from "next/link";
import { AUDIT_LEVEL_LABEL, type AuditItem } from "@/lib/rules";

const LEVEL_STYLE: Record<AuditItem["level"], string> = {
  hi: "bg-bad-bg text-bad",
  md: "bg-opt-bg text-opt",
  lo: "bg-todo-bg text-todo",
};

export function AuditPanel({ items, limit = 6 }: { items: AuditItem[]; limit?: number }) {
  const shown = items.slice(0, limit);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <h3 className="text-sm font-bold">Contrôle du dossier</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ok">Rien à signaler.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {shown.map((item, i) => (
            <li key={i}>
              <Link href={`/${item.goto}`} className="flex items-start gap-2 text-sm hover:underline">
                <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[item.level]}`}>
                  {AUDIT_LEVEL_LABEL[item.level]}
                </span>
                <span>{item.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > limit && <p className="mt-2 text-xs text-muted">+ {items.length - limit} autre(s) point(s)</p>}
    </div>
  );
}
