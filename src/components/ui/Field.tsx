import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// text-base su mobile: sotto i 16px Safari iOS zooma la pagina al focus.
const controlClass =
  "w-full rounded-xl border border-input bg-surface px-3.5 py-2 text-base leading-6 text-foreground shadow-xs placeholder:text-foreground/35 transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-semibold text-foreground/80", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "appearance-none pr-10", className)} {...props} />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45"
      />
    </div>
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm font-medium text-destructive">{children}</p>;
}

export function FieldHint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

/** Interruttore on/off basato su un vero checkbox (invio form nativo,
 * nessuno stato client): l'aspetto da "switch" è solo CSS. */
export function Toggle({
  label,
  description,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span className="h-6 w-10 rounded-full bg-border-strong transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,30,50,0.3)] transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

/** Blocco di un form lungo: titolo e spiegazione a sinistra, campi a destra
 * (impilati su mobile). Divide i form in parti leggibili invece di una
 * colonna unica di campi tutti uguali. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-x-8 gap-y-4 border-b border-border py-6 first-of-type:pt-0 last-of-type:border-b-0 md:grid-cols-[12rem_minmax(0,1fr)]",
        className,
      )}
    >
      <div>
        <h2 className="font-display text-[15px] font-bold leading-snug text-foreground">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}

/** Barra finale di un form: azioni allineate a destra (pulsante principale
 * per ultimo), a tutta larghezza su mobile. */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Scelta singola a segmenti (radio nativi, invio form nativo): stessa
 * estetica del controllo segmentato dei filtri. */
export function RadioSegment<T extends string>({
  name,
  options,
  value,
  defaultValue,
  onChange,
  className,
}: {
  name: string;
  options: { value: T; label: ReactNode }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 rounded-xl bg-muted p-1", className)}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground has-[:checked]:bg-surface has-[:checked]:text-foreground has-[:checked]:shadow-[0_1px_2px_rgba(15,30,50,0.1),0_0_0_1px_rgba(15,30,50,0.04)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            {...(value !== undefined
              ? { checked: value === opt.value, onChange: () => onChange?.(opt.value) }
              : { defaultChecked: defaultValue === opt.value, onChange: () => onChange?.(opt.value) })}
            className="sr-only"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
