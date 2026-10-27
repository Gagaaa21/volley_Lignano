"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Stethoscope } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CertificateSaveResult, StatusLabel } from "@/lib/medical/certificate";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CertificateDatesForm } from "./CertificateDatesForm";

/**
 * Il certificato medico sulla pagina del genitore: se è valido e, se non lo è o scade entro un mese (in rosso), le due date da
 * scrivere subito, quelle del certificato nuovo. Se è in regola le date si cambiano a richiesta. Salvate, il riquadro si aggiorna
 * da solo.
 */
export function FamilyCertificateCard({
  label,
  issuedOn,
  validUntil,
  author,
  today,
  save,
}: {
  label: StatusLabel;
  issuedOn: string | null;
  validUntil: string | null;
  /** «Scritte da voi · 13 mar, 10:02» / «Scritte da Gaga · …»; null senza date. */
  author: string | null;
  today: string;
  save: (issuedOn: string, validUntil: string) => Promise<CertificateSaveResult>;
}) {
  const inOrder = label.tone === "success";
  const red = label.tone === "danger";
  const [open, setOpen] = useState(!inOrder);
  const [saved, setSaved] = useState(false);

  return (
    <section
      id="certificato"
      className={cn(
        "scroll-mt-6 rounded-2xl border bg-card px-4 py-4 shadow-card sm:px-5",
        red ? "border-destructive/50 bg-destructive/[0.04]" : "border-border",
      )}
      data-family-certificate={label.tone}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Stethoscope className={cn("h-5 w-5", red ? "text-destructive" : "text-primary")} aria-hidden />
          Certificato medico
        </h2>
        <Badge tone={label.tone} className={cn(red && "bg-destructive text-destructive-foreground")} data-family-certificate-badge>
          {label.badge}
        </Badge>
      </div>
      <p className={cn("mt-2 text-sm", red ? "font-semibold text-destructive" : "text-foreground/80")} data-family-certificate-detail>
        {label.detail}
      </p>
      {author && <p className="mt-1 text-[12px] text-muted-foreground">{author}</p>}
      {saved && !open && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-success" role="status" data-family-certificate-saved>
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Grazie, date salvate.
        </p>
      )}

      {open ? (
        <div className="mt-4">
          {red || validUntil === null ? (
            <p className="mb-3 text-sm text-foreground/80">
              Quando avete fatto la visita, scegliete qui il giorno e fino a quando vale il certificato: lo staff lo vede subito.
            </p>
          ) : null}
          {/* Da rinnovare: si parte da zero (le date sono quelle del certificato nuovo, e la scadenza si propone da sola). */}
          <CertificateDatesForm
            issuedOn={red ? null : issuedOn}
            validUntil={red ? null : validUntil}
            today={today}
            save={save}
            onSaved={() => {
              setSaved(true);
              setOpen(false);
            }}
            submitLabel="Salva le date"
          />
        </div>
      ) : (
        <div className="mt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} data-family-certificate-change>
            <CalendarDays className="h-4 w-4" />
            {validUntil === null ? "Scrivi le date" : "Cambia le date"}
          </Button>
        </div>
      )}
    </section>
  );
}
