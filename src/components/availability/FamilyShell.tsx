import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

/**
 * La cornice della pagina del genitore: lo stemma e basta, niente menù del sito né «Area tecnici». La pagina non porta
 * altrove con il codice del link (vedi `referrer` nei metadati della pagina).
 */
export function FamilyShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="page-header">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4 sm:px-6">
          <Logo href="/" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-14 pt-8 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}
