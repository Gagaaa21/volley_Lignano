"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { CertificateDateForm } from "@/components/medical/CertificateDateForm";
import { clearStaffCertificateAction, saveStaffCertificateAction } from "./actions";

/**
 * Sotto ogni atleta: i pulsanti per avvisare il genitore (arrivano già pronti dal server) e, a richiesta, il giorno della visita da
 * scrivere o correggere qui, al posto del genitore (la scadenza viene da sé). Salvato, si richiude e l'elenco si aggiorna da solo.
 */
export function CertificateEditor({
  athleteId,
  athleteName,
  issuedOn,
  today,
  children,
}: {
  athleteId: string;
  athleteName: string;
  issuedOn: string | null;
  today: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasDate = issuedOn !== null;

  return (
    <div>
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
          {open ? "Chiudi" : hasDate ? "Cambia la data" : "Inserisci la data"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 max-w-2xl rounded-2xl border border-border bg-surface px-4 py-4 shadow-xs" data-certificate-editor>
          <CertificateDateForm
            issuedOn={issuedOn}
            today={today}
            save={(issued) => saveStaffCertificateAction(athleteId, issued)}
            onSaved={() => setOpen(false)}
          />
          {hasDate && (
            <form action={clearStaffCertificateAction} className="mt-4 border-t border-border pt-3">
              <input type="hidden" name="athleteId" value={athleteId} />
              <ConfirmSubmitButton
                confirmMessage={`Togliere la data del certificato di ${athleteName}? Tornerà «da inserire».`}
                size="xs"
                variant="danger-ghost"
                data-certificate-clear
              >
                <Trash2 className="h-3.5 w-3.5" />
                Togli la data
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
