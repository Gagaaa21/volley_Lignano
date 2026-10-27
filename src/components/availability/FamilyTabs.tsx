"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { CalendarX2, Stethoscope } from "lucide-react";
import { cn } from "@/lib/cn";
import { familySectionQuery, type FamilySection } from "@/lib/availability/familySection";

const ICONS = { assenze: CalendarX2, certificato: Stethoscope } as const;

type Tone = "success" | "danger" | "warning" | "primary" | "neutral";

const DOT: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-destructive",
  warning: "bg-warning",
  primary: "bg-primary",
  neutral: "bg-muted-foreground/45",
};

const TEXT: Record<Tone, string> = {
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
  primary: "text-primary",
  neutral: "text-muted-foreground",
};

export interface FamilyTab {
  id: FamilySection;
  label: string;
  /** Lo stato in una riga, sotto il nome della scheda: «Valido», «Scade tra 12 giorni», «2 assenze segnalate»… */
  summary: string;
  tone: Tone;
  /** C'è qualcosa da fare: la scheda ha una pallina in angolo anche quando non è quella aperta. */
  attention?: boolean;
  panel: ReactNode;
}

const hashSnapshot = () => window.location.hash;
const hashServerSnapshot = () => "";

/**
 * Le due sezioni della pagina del genitore (assenze alle partite e certificato medico) come due schede ben distinte in cima: ognuna
 * con la sua icona e il suo stato in vista, così si capisce subito se c'è qualcosa da fare. Le sezioni restano tutte nella pagina
 * (quella non aperta è solo nascosta): quello che si sta scrivendo in una non si perde passando all'altra. La sezione aperta resta
 * nell'indirizzo (`?sezione=`), così una ricarica non cambia scheda. Frecce, Home e Fine passano da una scheda all'altra.
 */
export function FamilyTabs({ tabs, initial }: { tabs: FamilyTab[]; initial: FamilySection }) {
  const [chosen, setChosen] = useState<FamilySection | null>(null);
  // Un indirizzo con `#certificato` (come nei primi messaggi dello staff) apre la scheda del certificato, anche dopo il caricamento
  // e anche se si era già toccata un'altra scheda: vale sempre l'ultimo indirizzo aperto.
  const subscribeHash = useCallback((callback: () => void) => {
    const onChange = () => {
      setChosen(null);
      callback();
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot, hashServerSnapshot);
  const buttons = useRef<Partial<Record<FamilySection, HTMLButtonElement | null>>>({});

  const ids = tabs.map((tab) => tab.id);
  const fromHash = hash === "#certificato" && ids.includes("certificato") ? "certificato" : null;
  const requested = chosen ?? fromHash ?? initial;
  const active = ids.includes(requested) ? requested : ids[0];

  function select(id: FamilySection, focus = false) {
    setChosen(id);
    // L'indirizzo segue la scheda (e perde l'eventuale #): una ricarica resta dove si era. Nessuna richiesta al server.
    try {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${familySectionQuery(id)}`);
    } catch {
      // Ambienti senza history (anteprime): la scheda cambia lo stesso.
    }
    if (focus) buttons.current[id]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = ids.indexOf(active);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % ids.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + ids.length) % ids.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(ids[next], true);
  }

  return (
    <div data-family-tabs={active}>
      <div role="tablist" aria-label="Sezioni" onKeyDown={onKeyDown} className="grid grid-cols-2 gap-2.5">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          const Icon = ICONS[tab.id];
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[tab.id] = element;
              }}
              type="button"
              role="tab"
              id={`family-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`family-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={cn(
                "relative flex min-h-[4.75rem] flex-col items-start justify-between gap-2 rounded-2xl border px-3 py-3 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4",
                selected
                  ? "border-primary/45 bg-card shadow-card ring-1 ring-primary/15"
                  : "border-transparent bg-muted/70 hover:bg-muted active:bg-muted",
              )}
              data-family-tab={tab.id}
              data-tone={tab.tone}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                    selected ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className={cn("text-[13px] font-bold leading-tight sm:text-sm", selected ? "text-foreground" : "text-foreground/75")}>{tab.label}</span>
              </span>
              <span className={cn("flex items-center gap-1.5 text-[12px] font-semibold leading-tight", TEXT[tab.tone])} data-family-tab-summary>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tab.tone])} aria-hidden />
                {tab.summary}
              </span>
              {tab.attention && !selected && (
                <span
                  className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-destructive"
                  aria-hidden
                  data-family-tab-attention
                />
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`family-panel-${tab.id}`}
          aria-labelledby={`family-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="mt-5"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
