"use client";

import { useSyncExternalStore } from "react";
import { BookOpen, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

const STORAGE_KEY = "vl-scout-welcome-dismissed";
const CHANGE_EVENT = "vl-scout-welcome-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Memoria non disponibile: il riquadro tornerà alla prossima apertura, nessun danno.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Riquadro «Prima volta con lo Scout?» in cima all'elenco delle partite:
 * porta alla guida passo passo (su una partita vera, dove la guida parte da
 * sola) e al manuale PDF. Si nasconde per sempre con «Non mostrare più» o
 * dopo aver avviato la guida; la guida resta sempre dietro al punto
 * interrogativo. Sul server non compare (`getServerSnapshot` = nascosto): così
 * non c'è un lampo di contenuto prima di sapere se è già stato chiuso.
 */
export function ScoutWelcome({ guideHref }: { guideHref: string | null }) {
  const hidden = useSyncExternalStore(subscribe, isDismissed, () => true);
  if (hidden) return null;

  return (
    <Card className="mb-6 border-primary/25 bg-primary-soft/50" data-scout-welcome>
      <CardBody className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:gap-5 sm:pt-5">
        <span className="icon-chip hidden shrink-0 sm:grid">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-foreground">Prima volta con lo Scout?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Lo Scout si impara in pochi minuti. La guida ti accompagna passo passo con una partita vera davanti, dalla preparazione al tabellino, e spiega ogni
            pulsante. Se preferisci, il manuale con le schermate commentate è il pulsante «Manuale d&apos;uso (PDF)» qui sopra.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {guideHref && (
            <LinkButton href={guideHref} onClick={dismiss} data-scout-guide-start>
              <ListChecks className="h-4 w-4" />
              Avvia la guida
            </LinkButton>
          )}
          <Button variant="quiet" size="sm" onClick={dismiss} data-scout-welcome-dismiss>
            Non mostrare più
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
