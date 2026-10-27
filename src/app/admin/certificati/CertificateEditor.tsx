"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { CertificateDatesForm } from "@/components/medical/CertificateDatesForm";
import { clearStaffCertificateAction, saveStaffCertificateAction } from "./actions";

/**
 * Sotto ogni atleta: i pulsanti per avvisare il genitore (arrivano già pronti dal server) e, a richiesta, le due date da scrivere o
 * correggere qui, al posto del genitore. Salvato, si richiude e l'elenco si aggiorna da solo.
 */
export function CertificateEditor({
  athleteId,
  athleteName,
  issuedOn,
  validUntil,
  today,
  children,
}: {
  athleteId: string;
  athleteName: string;
  issuedOn: string | null;
  validUntil: string | null;
  today: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasDates = validUntil !== null;

  return (
    <div className="mt-3 sm:pl-[3.25rem]">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button
          type="button"
          size="sm"
          variant={open ? "quiet" : "outline"}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          data-certificate-edit
        >
          {open ? <X className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          {open ? "Chiudi" : hasDates ? "Cambia le date" : "Inserisci le date"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 max-w-xl rounded-xl border border-border bg-surface-muted/60 px-3.5 py-3.5" data-certificate-editor>
          <CertificateDatesForm
            issuedOn={issuedOn}
            validUntil={validUntil}
            today={today}
            compact
            save={(issued, until) => saveStaffCertificateAction(athleteId, issued, until)}
            onSaved={() => setOpen(false)}
          />
          {hasDates && (
            <form action={clearStaffCertificateAction} className="mt-3 border-t border-border pt-3">
              <input type="hidden" name="athleteId" value={athleteId} />
              <ConfirmSubmitButton
                confirmMessage={`Togliere le date del certificato di ${athleteName}? Tornerà «da inserire».`}
                size="xs"
                variant="danger-ghost"
                data-certificate-clear
              >
                <Trash2 className="h-3.5 w-3.5" />
                Togli le date
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
