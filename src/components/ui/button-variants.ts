import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[-0.005em] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--color-sea-500),var(--color-sea-900))] text-primary-foreground shadow-[0_10px_24px_-12px_color-mix(in_oklab,var(--primary)_65%,transparent)] hover:shadow-[0_14px_30px_-12px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:-translate-y-px",
  secondary: "bg-sand-400 text-sea-950 hover:bg-sand-300 shadow-sm shadow-sand-900/10",
  outline:
    "border border-border-subtle bg-surface text-foreground hover:border-primary/30 hover:bg-surface-muted",
  ghost: "text-primary hover:bg-primary/8",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
