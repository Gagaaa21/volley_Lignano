"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * La finestra dello Scout: dal basso sul telefono, al centro dallo schermo medio in su. Si chiude con la X, con Esc o
 * toccando fuori. Ci stanno le scelte dei tasti dei punti («chi?», l'errore) e la ricezione, che si apre da sola.
 * `wide` la allarga per chi ha due colonne (per esempio il campo e i voti affiancati); `closeOnBackdrop={false}` non la chiude
 * toccando fuori (la ricezione, che si apre da sola: un tocco di troppo non deve cancellarla).
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  testId,
  wide = false,
  closeOnBackdrop = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  testId: string;
  wide?: boolean;
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    // Esc chiude solo la finestra: in cattura e fermando l'evento, lo schermo intero simulato che sta sotto (che si chiude con
    // Esc) resta com'è. Fermarlo serve anche perché lo schermo intero, ridisegnandosi, cambierebbe questo ascolto a metà
    // dell'evento e la finestra non vedrebbe più il tasto.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/45 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        data-scout-sheet={testId}
        className={cn(
          "max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)] sm:rounded-2xl sm:p-5",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold leading-tight text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
          </div>
          <Button variant="quiet" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
