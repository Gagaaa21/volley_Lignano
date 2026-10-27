"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, ImageOff, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { CertificateForm } from "@/components/medical/CertificateForm";
import { clearStaffCertificateAction, removeStaffCertificatePhotoAction, saveStaffCertificateAction } from "./actions";

/**
 * Sotto ogni atleta: i pulsanti per avvisare il genitore e vedere la foto (arrivano già pronti dal server) e, a richiesta, il giorno
 * della visita e la foto da scrivere o correggere qui, al posto del genitore (la scadenza viene da sé). Salvato, si richiude e
 * l'elenco si aggiorna da solo.
 */
export function CertificateEditor({
  athleteId,
  athleteName,
  issuedOn,
  photo,
  today,
  children,
}: {
  athleteId: string;
  athleteName: string;
  issuedOn: string | null;
  photo: { uploadedAt: string } | null;
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
          {open ? "Chiudi" : hasDate ? "Cambia data o foto" : "Inserisci data e foto"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 max-w-2xl rounded-2xl border border-border bg-surface px-4 py-4 shadow-xs" data-certificate-editor>
          <CertificateForm
            issuedOn={issuedOn}
            photo={photo}
            today={today}
            save={(formData) => saveStaffCertificateAction(athleteId, formData)}
            onSaved={() => setOpen(false)}
          />
          {hasDate && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
              {photo && (
                <form action={removeStaffCertificatePhotoAction}>
                  <input type="hidden" name="athleteId" value={athleteId} />
                  <ConfirmSubmitButton
                    confirmMessage={`Togliere la foto del certificato di ${athleteName}? Il giorno della visita resta.`}
                    size="xs"
                    variant="danger-ghost"
                    data-certificate-photo-remove
                  >
                    <ImageOff className="h-3.5 w-3.5" />
                    Togli la foto
                  </ConfirmSubmitButton>
                </form>
              )}
              <form action={clearStaffCertificateAction}>
                <input type="hidden" name="athleteId" value={athleteId} />
                <ConfirmSubmitButton
                  confirmMessage={`Togliere la data${photo ? " e la foto" : ""} del certificato di ${athleteName}? Tornerà «da inserire».`}
                  size="xs"
                  variant="danger-ghost"
                  data-certificate-clear
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {photo ? "Togli data e foto" : "Togli la data"}
                </ConfirmSubmitButton>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
