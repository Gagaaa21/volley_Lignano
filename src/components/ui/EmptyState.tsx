import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="icon-chip mb-4 h-12 w-12 rounded-2xl">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="font-display text-base font-bold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
