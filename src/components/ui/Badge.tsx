import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "gold" | "u14" | "u15";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-muted text-foreground/65",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
  gold: "bg-accent text-accent-foreground",
  u14: "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]",
  u15: "bg-[var(--color-u15-soft)] text-[var(--color-u15-strong)]",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold leading-5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
