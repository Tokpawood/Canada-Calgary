import type { ReactNode } from "react";
import type { Block, Inline } from "@/lib/miniMarkdown";

function Inl({ c }: { c: Inline[] }): ReactNode {
  return c.map((x, i) => {
    if (x.t === "text") return <span key={i}>{x.v}</span>;
    if (x.t === "code") return <code key={i} className="mono rounded bg-surface-2 px-1 text-[0.92em]">{x.v}</code>;
    if (x.t === "b") return <strong key={i} className="font-semibold text-ink"><Inl c={x.c} /></strong>;
    if (x.t === "s") return <s key={i} className="text-bad decoration-bad/60"><Inl c={x.c} /></s>;
    return <em key={i}><Inl c={x.c} /></em>;
  });
}

/** Affiche l'arbre produit par parseMarkdown, aux couleurs de l'application. */
export function Markdown({ blocks, skipFirstH1 = false }: { blocks: Block[]; skipFirstH1?: boolean }) {
  const list = skipFirstH1 && blocks[0]?.t === "h" && blocks[0].level === 1 ? blocks.slice(1) : blocks;
  return (
    <div className="flex flex-col gap-3 text-[14px] leading-relaxed">
      {list.map((b, i) => {
        switch (b.t) {
          case "h": {
            const cls = b.level <= 2 ? "mt-3 scroll-mt-28 border-t border-line pt-4 text-[16.5px] font-bold first:mt-0 first:border-0 first:pt-0" : "mt-1 scroll-mt-28 text-[14.5px] font-bold";
            return b.level <= 2 ? (
              <h3 key={i} id={b.id} className={cls}>
                <Inl c={b.c} />
              </h3>
            ) : (
              <h4 key={i} id={b.id} className={cls}>
                <Inl c={b.c} />
              </h4>
            );
          }
          case "p":
            return (
              <p key={i}>
                <Inl c={b.c} />
              </p>
            );
          case "ul":
          case "ol": {
            const Tag = b.t;
            return (
              <Tag key={i} className={`flex flex-col gap-1 pl-5 ${b.t === "ol" ? "list-decimal" : "list-disc"} marker:text-muted`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inl c={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="rounded-r-xl border-l-4 border-signal bg-signal/10 px-4 py-3">
                <Markdown blocks={b.c} />
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="border-line" />;
          case "table":
            return (
              <div key={i} className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-[13px]">
                  {b.head.length > 0 && (
                    <thead>
                      <tr className="border-b border-line text-left text-[12px] text-muted">
                        {b.head.map((h, j) => (
                          <th key={j} className="px-2 py-2 align-bottom font-semibold">
                            <Inl c={h} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-line/60 last:border-0">
                        {r.map((cell, k) => (
                          <td key={k} className="px-2 py-2 align-top">
                            <Inl c={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
