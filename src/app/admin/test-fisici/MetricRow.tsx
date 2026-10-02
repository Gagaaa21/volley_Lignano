import type { InputHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Riga di un valore numerico: badge icona a sinistra, etichetta, input a
 * destra allineato e in grassetto con l'unità accanto — stesso peso
 * tipografico della riga di un salto nell'app di riferimento (badge "SJ" +
 * numero a sinistra, valore grande in grassetto a destra), qui editabile
 * invece che di sola lettura. */
export function MetricRow({
  icon: Icon,
  label,
  unit,
  className,
  ...props
}: { icon: LucideIcon; label: string; unit?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground/70">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <input
          className={cn(
            "w-20 rounded-lg border-0 bg-transparent text-right font-display text-base font-bold text-foreground placeholder:text-foreground/25 placeholder:font-normal focus:bg-primary/6 focus:outline-none focus:ring-2 focus:ring-primary/20",
            className,
          )}
          {...props}
        />
        {unit && <span className="text-xs font-medium text-foreground/40">{unit}</span>}
      </span>
    </div>
  );
}

/** Contenitore a bordo tondo con righe separate da un filo sottile — stesso
 * linguaggio dei riquadri della Card condivisa (bordo + angoli arrotondati)
 * ma senza ombra propria, per non sommarsi a quella della Card esterna che
 * racchiude l'intero form. */
export function RowGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-surface", className)}>
      {children}
    </div>
  );
}
