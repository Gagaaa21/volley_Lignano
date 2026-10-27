import { cn } from "@/lib/cn";
import { dayLabel, shortDay, validityTimeline, type CertificateStatus } from "@/lib/medical/certificate";

/**
 * L'anno di validità del certificato in una barra: dalla visita (a sinistra) alla scadenza (a destra), con l'ultimo mese segnato
 * in rosso chiaro (da lì il certificato è «in scadenza») e un punto su oggi. La parte già passata è verde, o rossa quando manca
 * meno di un mese o è scaduto. Sotto, il giorno della visita e quello della scadenza. Niente stato: va bene ovunque.
 */
export function ValidityBar({
  issuedOn,
  validUntil,
  today,
  kind,
  labels = true,
  className,
}: {
  issuedOn: string;
  validUntil: string;
  today: string;
  kind: Exclude<CertificateStatus["kind"], "missing">;
  /** Le due date sotto la barra. */
  labels?: boolean;
  className?: string;
}) {
  const { today: at, warning } = validityTimeline({ issuedOn, validUntil }, today);
  const red = kind !== "valid";
  const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
  // Il punto di oggi non esce dalla barra, nemmeno il primo e l'ultimo giorno.
  const marker = `clamp(7px, ${pct(at)}, calc(100% - 7px))`;

  return (
    <div className={cn("w-full", className)} data-validity-bar={kind}>
      <div
        className="relative h-2 rounded-full bg-muted"
        role="img"
        aria-label={`Valido dal ${dayLabel(issuedOn)} al ${dayLabel(validUntil)}; in rosso l'ultimo mese.`}
      >
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-destructive/20" style={{ left: pct(warning) }} aria-hidden />
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", red ? "bg-destructive" : "bg-success")}
          style={{ width: pct(at) }}
          aria-hidden
        />
        <span
          className={cn(
            "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-card shadow-[0_1px_3px_rgba(15,30,50,0.25)]",
            red ? "border-destructive" : "border-success",
          )}
          style={{ left: marker }}
          title="Oggi"
          aria-hidden
        />
      </div>
      {labels && (
        <div className="tabular mt-2 flex items-baseline justify-between gap-3 text-[12px] leading-tight text-muted-foreground">
          <span>
            Visita <b className="font-semibold text-foreground/80">{shortDay(issuedOn)}</b>
          </span>
          <span className={cn("text-right", red && "text-destructive")}>
            {kind === "expired" ? "Scaduto il" : "Scade il"} <b className={cn("font-semibold", red ? "text-destructive" : "text-foreground/80")}>{shortDay(validUntil)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

/** Al posto della barra quando manca la visita: un binario vuoto, tratteggiato. */
export function EmptyValidityBar({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)} data-validity-bar="missing">
      <div className="h-2 rounded-full border border-dashed border-warning/60 bg-warning-soft/60" aria-hidden />
      <p className="mt-2 text-[12px] leading-tight text-muted-foreground">Manca il giorno della visita</p>
    </div>
  );
}
