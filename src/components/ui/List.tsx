import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Elenco in un'unica card con righe separate da un filo: sostituisce le
 * pile di card identiche una per elemento (più compatto, più leggibile). */
export function List({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border",
        className,
      )}
      {...props}
    />
  );
}

const rowClass = "flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5";

/** Riga di un List: con `href` diventa un link (tutta la riga cliccabile). */
export function ListItem({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={cn(rowClass, "transition-colors hover:bg-surface-muted", className)}>
        {children}
      </Link>
    );
  }
  return <div className={cn(rowClass, className)}>{children}</div>;
}
