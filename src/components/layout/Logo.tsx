import Link from "next/link";
import { Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  variant?: "default" | "inverted";
}

export function Logo({ className, variant = "default" }: LogoProps) {
  const inverted = variant === "inverted";
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sea-500 to-sea-700 text-white shadow-sm shadow-sea-900/30 transition-transform group-hover:scale-105">
        <Volleyball className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-display text-base font-bold tracking-tight",
            inverted ? "text-white" : "text-foreground",
          )}
        >
          Volley Lignano
        </span>
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-wider",
            inverted ? "text-sand-200" : "text-sand-600",
          )}
        >
          Femminile U14 · U15
        </span>
      </span>
    </Link>
  );
}
