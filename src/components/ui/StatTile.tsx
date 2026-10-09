import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const toneClass = {
  primary: "bg-primary-soft text-primary",
  gold: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  u14: "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]",
  u15: "bg-[var(--color-u15-soft)] text-[var(--color-u15-strong)]",
} as const;

/** Riquadro numero + etichetta: il numero è il protagonista (grottesco
 * largo, cifre tabellari), l'icona è un accento piccolo in alto a destra. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof toneClass;
  href?: string;
  className?: string;
}) {
  // Numero e etichetta sono paragrafi fratelli (numero prima): alcuni test
  // e2e leggono il valore come "il <p> che precede l'etichetta".
  const content = (
    <>
      {Icon && (
        <span className={cn("absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg sm:right-5 sm:top-5", toneClass[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <p className="display-wide tabular text-[2rem] leading-none text-foreground">{value}</p>
      <p className="mt-2 pr-8 text-[13px] font-semibold leading-snug text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const base = cn("stat-card block p-4 pt-5 sm:p-5 sm:pt-6", className);
  if (href) {
    return (
      <Link href={href} className={cn(base, "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised")}>
        {content}
      </Link>
    );
  }
  return <div className={base}>{content}</div>;
}
