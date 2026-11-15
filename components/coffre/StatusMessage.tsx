"use client";

import type { ReactNode } from "react";
import { IconX } from "@/components/icons";

/** Message d'erreur ou de confirmation, annoncé aux lecteurs d'écran et refermable. */
export function StatusMessage({ tone, children, onDismiss, className = "" }: { tone: "bad" | "ok"; children: ReactNode; onDismiss?: () => void; className?: string }) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] ${tone === "bad" ? "bg-bad-bg text-bad" : "bg-ok-bg text-ok"} ${className}`}
    >
      <p className="min-w-0 flex-1 break-words">{children}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Masquer le message" className="-my-1 -mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-70 hover:opacity-100 focus-visible:opacity-100">
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
