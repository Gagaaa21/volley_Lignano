"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BOARD_PATH as PATH } from "@/lib/diretta/tabellone";

/**
 * «Tabellone per la palestra»: un tablet al posto del tabellone segnapunti (vedi /tabellone), con il punteggio dello Scout. Non è
 * pubblico: si apre con l'accesso dello staff. Qui il pulsante per aprirlo, l'indirizzo da copiare e la partita finta per provarlo.
 */
export function TabelloneCard() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(PATH, window.location.origin).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Appunti non disponibili: l'indirizzo si legge nella guida.
    }
  }
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card sm:px-5" data-tabellone-card>
      <div className="flex items-start gap-3">
        <span className="icon-chip shrink-0">
          <MonitorSmartphone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-foreground">Tabellone per la palestra</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Un tablet al posto del tabellone segnapunti: punti, set vinti, chi batte e time-out (con il conto dei 30 secondi), presi dallo Scout
            ogni secondo, anche con la diretta spenta. Non è pubblico: sul tablet accedi con il tuo account, poi aprilo da qui, in orizzontale, e tocca
            «Schermo intero».
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={PATH}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              data-tabellone-open
            >
              <ExternalLink className="h-4 w-4" />
              Apri il tabellone
            </a>
            <Button type="button" variant="outline" onClick={copy} data-tabellone-copy>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiato" : "Copia l'indirizzo"}
            </Button>
            <a
              href={`${PATH}?prova=1`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:underline"
              data-tabellone-try
            >
              Prova con la partita finta
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
