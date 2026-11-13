"use client";

import { createContext, useContext, type ReactNode } from "react";

const DossierContext = createContext<string | null>(null);

export function DossierProvider({ dossierId, children }: { dossierId: string | null; children: ReactNode }) {
  return <DossierContext.Provider value={dossierId}>{children}</DossierContext.Provider>;
}

export function useDossierId(): string | null {
  return useContext(DossierContext);
}
