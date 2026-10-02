import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Input a pillola con icona a sinistra, nello stile delle schermate
 * dell'app di riferimento usata finora dallo staff per i test fisici
 * (campi tondi impilati verticalmente, un'icona per campo) — qui con i
 * colori del design system del sito al posto del tema scuro originale.
 * Non riusa il componente Input condiviso: i suoi stili base (rounded-xl,
 * padding) e questi (rounded-full, padding per l'icona) andrebbero in
 * conflitto nella stessa classe, quindi questo input è autonomo. */
export function PillInput({
  icon: Icon,
  className,
  ...props
}: { icon?: LucideIcon } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && (
        <Icon aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
      )}
      <input
        className={cn(
          "w-full rounded-full border border-border-subtle bg-surface py-3 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-primary/60 focus:outline-none focus:ring-4 focus:ring-primary/12 transition-all duration-150",
          Icon ? "pl-11" : "pl-4",
          className,
        )}
        {...props}
      />
    </div>
  );
}
