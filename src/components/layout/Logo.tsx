import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import crest from "@/assets/lignano-crest.png";

interface LogoProps {
  className?: string;
  variant?: "default" | "inverted";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}

const CHIP_SIZES = {
  sm: "h-9 w-9 p-1.5",
  md: "h-11 w-11 p-2",
  lg: "h-16 w-16 p-3",
};

export function Logo({ className, variant = "default", size = "md", showWordmark = true }: LogoProps) {
  const inverted = variant === "inverted";
  return (
    <Link href="/" className={cn("group flex items-center gap-3", className)}>
      <span className={cn("brand-chip shrink-0 transition-transform group-hover:scale-105", CHIP_SIZES[size])}>
        <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain" priority />
      </span>
      {showWordmark && (
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
              "text-[11px] font-semibold uppercase tracking-[0.16em]",
              inverted ? "text-sand-200" : "text-sand-600",
            )}
          >
            U14 · U15
          </span>
        </span>
      )}
    </Link>
  );
}
