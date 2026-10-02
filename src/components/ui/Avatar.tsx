import { cn } from "@/lib/cn";

export type AvatarTone = "primary" | "neutral" | "gold" | "u14" | "u15";
export type AvatarSize = "sm" | "md" | "lg" | "xl";

const tones: Record<AvatarTone, string> = {
  primary: "bg-primary-soft text-primary ring-primary/15",
  neutral: "bg-muted text-foreground/70 ring-border",
  gold: "bg-sand-100 text-sand-800 ring-sand-300/50",
  u14: "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)] ring-[var(--color-u14)]/20",
  u15: "bg-[var(--color-u15-soft)] text-[var(--color-u15-strong)] ring-[var(--color-u15)]/20",
};

const sizes: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-12 w-12 text-[15px]",
  xl: "h-14 w-14 text-lg",
};

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** Cerchio con le iniziali (atlete, staff, utente collegato). */
export function Avatar({
  name,
  tone = "primary",
  size = "md",
  className,
}: {
  name: string;
  tone?: AvatarTone;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold tracking-tight ring-1 ring-inset",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
