import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import crest from "@/assets/lignano-crest.png";

interface LogoProps {
  className?: string;
  variant?: "default" | "inverted";
}

export function Logo({ className, variant = "default" }: LogoProps) {
  const inverted = variant === "inverted";
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)}>
      <Image
        src={crest}
        alt="Stemma Volley Lignano"
        className="h-11 w-11 shrink-0 object-contain transition-transform group-hover:scale-105"
        priority
      />
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
