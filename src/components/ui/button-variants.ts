import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sea-500 whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-sea-700 text-white hover:bg-sea-600 shadow-sm shadow-sea-900/20",
  secondary: "bg-sand-400 text-sea-950 hover:bg-sand-300 shadow-sm shadow-sand-900/10",
  outline: "border border-border-subtle bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-sea-700 hover:bg-sea-100",
  danger: "bg-red-600 text-white hover:bg-red-500",
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
