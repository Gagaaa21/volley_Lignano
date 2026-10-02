import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/** Intestazione standard di ogni pagina dell'area tecnici: ritorno
 * contestuale facoltativo, titolo, descrizione breve, azioni a destra (che
 * su mobile vanno a capo sotto il titolo) e uno slot `help` accanto al
 * titolo per l'icona della guida di sezione. */
export function PageHeader({
  back,
  eyebrow,
  title,
  description,
  actions,
  help,
  className,
}: {
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  help?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-1 mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <div className="flex items-center gap-2">
            <h1 className="display-wide min-w-0 text-[1.75rem] leading-[1.1] text-foreground sm:text-[2.125rem]">
              {title}
            </h1>
            {help}
          </div>
          {description && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Titolo di una sezione dentro una pagina (sopra un elenco, una griglia di
 * card…), con azione facoltativa allineata a destra. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold leading-tight tracking-[-0.012em] text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
