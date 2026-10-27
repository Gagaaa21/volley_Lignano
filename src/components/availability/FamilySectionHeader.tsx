import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * L'intestazione di una sezione della pagina del genitore (le assenze alle partite): una fascia con l'icona, il nome della sezione e
 * una riga che spiega cosa si fa qui. Ha lo stesso aspetto della fascia del riquadro del certificato, così le due sezioni si
 * somigliano e si distinguono per il colore e l'icona.
 */
export function FamilySectionHeader({
  icon: Icon,
  eyebrow,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start gap-3.5 rounded-2xl bg-primary-soft/60 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5", className)}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(15,30,50,0.12)]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-0.5 font-display text-[1.375rem] font-extrabold leading-tight text-foreground">{title}</h2>
        {children && <div className="mt-1.5 text-sm leading-relaxed text-foreground/75">{children}</div>}
      </div>
    </header>
  );
}
