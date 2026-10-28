"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CalendarCheck2, Camera, Check, ImageUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { certificateStatus, dayLabel, expiryFor, isIsoDate, type CertificateSaveResult } from "@/lib/medical/certificate";
import { compressPhoto } from "@/lib/medical/compressPhoto";
import { sizeLabel } from "@/lib/medical/photo";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { ValidityBar } from "./ValidityBar";

type ChosenPhoto = { blob: Blob; url: string };

/**
 * Il certificato medico in un modulo: il giorno della visita, con il calendario del telefono (la scadenza, un anno dopo, compare
 * subito con la barra della validità e un avviso se con quella data è già in scadenza o scaduto), e la foto del certificato, da
 * scattare o scegliere: si rimpicciolisce qui prima di mandarla e se ne vede l'anteprima. Lo usano il genitore dal suo link e lo
 * staff: cambia solo l'azione che salva, che ricontrolla tutto da sé.
 */
export function CertificateForm({
  issuedOn,
  photo,
  today,
  save,
  onSaved,
  submitLabel = "Salva",
}: {
  issuedOn: string | null;
  /** La foto già caricata per questa visita, se c'è (resta finché la visita non cambia). */
  photo: { uploadedAt: string } | null;
  /** Oggi, dal server: la visita non può essere dopo. */
  today: string;
  save: (formData: FormData) => Promise<CertificateSaveResult>;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const id = useId();
  const [issued, setIssued] = useState(issuedOn ?? "");
  const [chosen, setChosen] = useState<ChosenPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const chosenUrl = useRef<string | null>(null);

  // L'anteprima della foto scelta vive finché serve: poi si libera la memoria.
  useEffect(() => () => {
    if (chosenUrl.current) URL.revokeObjectURL(chosenUrl.current);
  }, []);

  const visit = isIsoDate(issued) ? issued : null;
  const future = visit !== null && visit > today;
  const validUntil = visit && !future ? expiryFor(visit) : null;
  const status = validUntil ? certificateStatus({ validUntil }, today) : null;
  const sameVisit = issuedOn !== null && issued === issuedOn;
  // Con una visita diversa la foto di prima va via (era del certificato vecchio).
  const keptPhoto = sameVisit ? photo : null;
  const changed = !sameVisit || chosen !== null;

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const blob = await compressPhoto(file);
      if (chosenUrl.current) URL.revokeObjectURL(chosenUrl.current);
      const url = URL.createObjectURL(blob);
      chosenUrl.current = url;
      setChosen({ blob, url });
    } catch {
      setError("Questa foto non si apre: scegline un'altra, oppure fai uno screenshot del certificato e scegli quello.");
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function dropPhoto() {
    if (chosenUrl.current) URL.revokeObjectURL(chosenUrl.current);
    chosenUrl.current = null;
    setChosen(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData();
    data.set("issuedOn", issued);
    if (chosen) data.set("photo", new File([chosen.blob], "certificato.jpg", { type: "image/jpeg" }));
    startTransition(async () => {
      let result: CertificateSaveResult;
      try {
        result = await save(data);
      } catch {
        result = { ok: false, error: "Non sono riuscito a salvare: controlla la connessione e riprova." };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      dropPhoto();
      onSaved?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" data-certificate-form>
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
              <ValidityBar issuedOn={visit!} validUntil={validUntil} today={today} kind={status.kind} labels={false} className="mt-2.5" />
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {future
                ? "La visita non può essere in un giorno che deve ancora venire."
                : "La scadenza compare qui: il certificato vale un anno dalla visita."}
            </p>
          )}
        </div>
      </div>

      <div data-certificate-photo-field>
        <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">
          Foto del certificato <span className="font-normal text-muted-foreground">· la vede solo lo staff</span>
        </p>
        <input
          ref={fileInput}
          id={`${id}-photo`}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => choosePhoto(event.target.files?.[0])}
          data-certificate-photo-input
        />
        {chosen ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft/40 p-2.5" data-certificate-photo-chosen>
            {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob:), non un'immagine del sito */}
            <img src={chosen.url} alt="Anteprima della foto del certificato" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Foto pronta</p>
              <p className="text-[12px] text-muted-foreground">{sizeLabel(chosen.blob.size)} · si carica quando salvi</p>
            </div>
            <Button type="button" size="icon-sm" variant="quiet" onClick={dropPhoto} aria-label="Togli la foto scelta">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor={`${id}-photo`}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 transition-colors hover:bg-surface-muted/70",
              keptPhoto ? "border-border-strong/60 bg-surface" : "border-primary/40 bg-primary-soft/40",
            )}
            data-certificate-photo-pick
          >
            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", keptPhoto ? "bg-success-soft text-success" : "bg-primary-soft text-primary")}>
              {preparing ? <Loader2 className="h-5 w-5 animate-spin" /> : keptPhoto ? <Check className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {preparing ? "Preparo la foto…" : keptPhoto ? "Foto già caricata" : "Scatta o scegli una foto"}
              </span>
              <span className="block text-[12px] leading-snug text-muted-foreground">
                {keptPhoto
                  ? "Tocca qui per sostituirla."
                  : photo && !sameVisit
                    ? "Con la visita nuova la foto di prima va via: carica quella del certificato nuovo."
                    : "Basta una foto leggibile, anche dal telefono."}
              </span>
            </span>
            <ImageUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </label>
        )}
      </div>

      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={pending || preparing || !validUntil || !changed} className="w-full sm:w-auto" data-certificate-save>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}
