import type { ReactNode } from "react";
import { Link2 } from "lucide-react";

/** Contenitore dello strumento del portale FIPAV. Separa con chiarezza ciò che
 * arriva dal portale (da aggiungere, correggere o confermare) dalle partite
 * già registrate nel sito, che stanno nell'elenco sopra. */
export function PortalPanel({ children }: { children: ReactNode }) {
  return (
    <section
      id="portale"
      aria-labelledby="portale-titolo"
      className="mt-14 scroll-mt-24 rounded-3xl border border-primary/25 bg-primary-soft/60 p-4 sm:p-6"
    >
      <header className="mb-6 flex items-start gap-3.5" data-tour="section-partite-official">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden
        >
          <Link2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Strumento · qui non ci sono partite registrate</p>
          <h2
            id="portale-titolo"
            className="mt-1 font-display text-xl font-bold leading-tight tracking-[-0.012em] text-foreground"
          >
            Collegamento con il portale FIPAV
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Le partite e i risultati qui sotto sono quelli del portale ufficiale, non ancora del sito. Servono per
            aggiungere partite, correggerle e compilare i risultati; le partite registrate sono nell&apos;elenco sopra.
            Nulla cambia senza la tua conferma.
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-10 [&>section]:mb-0">{children}</div>
    </section>
  );
}
