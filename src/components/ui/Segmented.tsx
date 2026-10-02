import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Controllo segmentato basato su link (filtri via querystring, niente JS):
 * la voce attiva è una "pastiglia" bianca sul binario grigio. Con `stretch`
 * le voci si dividono tutta la larghezza disponibile (utile su mobile). */
export function SegmentedLinks({
  items,
  className,
  ariaLabel,
  stretch = false,
  dataTour,
}: {
  items: { href: string; label: ReactNode; active: boolean }[];
  className?: string;
  ariaLabel?: string;
  stretch?: boolean;
  dataTour?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      data-tour={dataTour}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-muted p-1 no-scrollbar",
        stretch && "flex w-full sm:inline-flex sm:w-auto",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          scroll={false}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition-colors",
            stretch && "flex-1 sm:flex-none",
            item.active
              ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(15,30,50,0.08),0_0_0_1px_rgba(15,30,50,0.04)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Stesso aspetto di SegmentedLinks, ma con pulsanti (stato lato client). */
export function SegmentedButtons<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-xl bg-muted p-1", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            title={item.title}
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(15,30,50,0.08),0_0_0_1px_rgba(15,30,50,0.04)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
