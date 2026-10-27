"use client";

import { useId, useState, useTransition } from "react";
import { CalendarCheck2, Loader2 } from "lucide-react";
import { isIsoDate, oneYearAfter, type CertificateSaveResult } from "@/lib/medical/certificate";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/Field";

/**
 * Le due date del certificato medico, con il calendario del telefono (`type="date"`): il giorno della visita e fino a quando vale.
 * Scelta la visita, la scadenza si propone da sola un anno dopo (finché non la si cambia a mano). Lo usano il genitore dal suo link
 * e lo staff: cambia solo l'azione che salva, che ricontrolla tutto da sé.
 */
export function CertificateDatesForm({
  issuedOn,
  validUntil,
  today,
  save,
  onSaved,
  submitLabel = "Salva",
  compact = false,
}: {
  issuedOn: string | null;
  validUntil: string | null;
  /** Oggi, dal server: la visita non può essere dopo. */
  today: string;
  save: (issuedOn: string, validUntil: string) => Promise<CertificateSaveResult>;
  onSaved?: () => void;
  submitLabel?: string;
  /** Nella riga dello staff: i due campi affiancati già da schermi piccoli. */
  compact?: boolean;
}) {
  const id = useId();
  const [issued, setIssued] = useState(issuedOn ?? "");
  const [until, setUntil] = useState(validUntil ?? "");
  // Finché nessuno l'ha toccata, la scadenza segue la visita (un anno dopo).
  const [untilChosen, setUntilChosen] = useState(validUntil !== null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const changed = issued !== (issuedOn ?? "") || until !== (validUntil ?? "");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await save(issued, until);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      onSaved?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-certificate-form>
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 min-[420px]:grid-cols-2"}>
        <div>
          <Label htmlFor={`${id}-issued`}>Giorno della visita</Label>
          <Input
            id={`${id}-issued`}
            type="date"
            value={issued}
            max={today}
            required
            onChange={(event) => {
              const value = event.target.value;
              setIssued(value);
              setSaved(false);
              if (!untilChosen && isIsoDate(value)) setUntil(oneYearAfter(value));
            }}
            data-certificate-issued
          />
        </div>
        <div>
          <Label htmlFor={`${id}-until`}>Valido fino al</Label>
          <Input
            id={`${id}-until`}
            type="date"
            value={until}
            min={isIsoDate(issued) ? issued : undefined}
            required
            onChange={(event) => {
              setUntil(event.target.value);
              setUntilChosen(true);
              setSaved(false);
            }}
            data-certificate-until
          />
        </div>
      </div>
      <FieldHint>Di solito vale un anno dalla visita: controlla la data scritta sul certificato. Il certificato non serve mandarlo.</FieldHint>
      <FieldError>{error}</FieldError>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !issued || !until || (!changed && validUntil !== null)} data-certificate-save>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
          {submitLabel}
        </Button>
        {saved && !pending && (
          <span className="text-sm font-semibold text-success" role="status" data-certificate-saved>
            Salvato
          </span>
        )}
      </div>
    </form>
  );
}
