import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "quiet"
  | "soft"
  | "danger"
  | "danger-ghost";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold tracking-[-0.006em] select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(15,30,50,0.16),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-primary-hover",
  secondary: "bg-sand-400 text-sea-950 shadow-xs hover:bg-sand-300",
  outline:
    "border border-border-strong/80 bg-surface text-foreground shadow-xs hover:border-border-strong hover:bg-surface-muted",
  ghost: "text-primary hover:bg-primary-soft",
  quiet: "text-muted-foreground hover:bg-muted hover:text-foreground",
  soft: "bg-primary-soft text-primary hover:bg-sea-100",
  danger: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive-strong",
  "danger-ghost": "text-destructive hover:bg-destructive/8",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 rounded-lg px-2.5 text-xs",
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-10 w-10 p-0",
  "icon-sm": "h-8 w-8 rounded-lg p-0",
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
