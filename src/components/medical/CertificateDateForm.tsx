"use client";

import { useId, useState, useTransition } from "react";
import { CalendarCheck2, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { certificateStatus, dayLabel, expiryFor, isIsoDate, type CertificateSaveResult } from "@/lib/medical/certificate";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { ValidityBar } from "./ValidityBar";

/**
 * Il giorno della visita, con il calendario del telefono (`type="date"`): è l'unica cosa da scegliere. Il certificato dura sempre un
 * anno, quindi accanto compare subito fino a quando vale, con la barra della validità e, se con quella data è già in scadenza o
 * scaduto, un avviso. Lo usano il genitore dal suo link e lo staff: cambia solo l'azione che salva, che ricontrolla tutto da sé.
 */
export function CertificateDateForm({
  issuedOn,
  today,
  save,
  onSaved,
  submitLabel = "Salva",
}: {
  issuedOn: string | null;
  /** Oggi, dal server: la visita non può essere dopo. */
  today: string;
  save: (issuedOn: string) => Promise<CertificateSaveResult>;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const id = useId();
  const [issued, setIssued] = useState(issuedOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = isIsoDate(issued) ? issued : null;
  const future = chosen !== null && chosen > today;
  const validUntil = chosen && !future ? expiryFor(chosen) : null;
  const status = validUntil ? certificateStatus({ validUntil }, today) : null;
  const unchanged = issuedOn !== null && issued === issuedOn;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await save(issued);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-certificate-form>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-stretch">
        <div>
          <Label htmlFor={`${id}-issued`}>Giorno della visita</Label>
          <Input
            id={`${id}-issued`}
            type="date"
            value={issued}
            max={today}
            required
            onChange={(event) => {
              setIssued(event.target.value);
              setError(null);
            }}
            className="h-12 text-[17px] font-semibold tabular sm:h-11 sm:text-[15px]"
            data-certificate-issued
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Basta la data: il certificato non serve mandarlo.</p>
        </div>

        <div
          className={cn(
            "flex min-h-[6.25rem] flex-col justify-center rounded-xl border px-3.5 py-3",
            !validUntil
              ? "border-dashed border-border-strong/70 bg-surface-muted/50"
              : status?.kind === "valid"
                ? "border-success/30 bg-success-soft/50"
                : "border-destructive/35 bg-destructive/[0.06]",
          )}
          aria-live="polite"
          data-certificate-preview={status?.kind ?? "none"}
        >
          {validUntil && status && status.kind !== "missing" ? (
            <>
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
                Valido fino al
              </p>
              <p
                className={cn("mt-0.5 font-display text-lg font-extrabold leading-tight", status.kind === "valid" ? "text-foreground" : "text-destructive")}
                data-certificate-until
              >
                {dayLabel(validUntil)}
              </p>
              {status.kind !== "valid" && (
                <p className="mt-0.5 text-[13px] font-semibold text-destructive">
                  {status.kind === "expired" ? "Con questa data è già scaduto." : "Con questa data scade entro un mese."}
                </p>
              )}
              <ValidityBar issuedOn={chosen!} validUntil={validUntil} today={today} kind={status.kind} labels={false} className="mt-2.5" />
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {future
                ? "La visita non può essere in un giorno che deve ancora venire."
                : "La scadenza la calcola il sito: il certificato vale un anno dalla visita."}
            </p>
          )}
        </div>
      </div>

      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={pending || !validUntil || unchanged} className="w-full sm:w-auto" data-certificate-save>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}
