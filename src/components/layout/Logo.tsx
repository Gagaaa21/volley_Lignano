import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import crestU14U15 from "@/assets/lignano-crest.png";
import crestMinivolley from "@/assets/minivolley-crest.png";
import type { TrainingTeam } from "@/lib/types";

interface LogoProps {
  className?: string;
  variant?: "default" | "inverted";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  subtitle?: string;
  team?: TrainingTeam;
  href?: string;
}

const CHIP_SIZES = {
  sm: "h-9 w-9 p-1.5",
  md: "h-11 w-11 p-2",
  lg: "h-16 w-16 p-3",
};

const CREST_BY_TEAM: Record<TrainingTeam, typeof crestU14U15> = {
  u14u15: crestU14U15,
  minivolley: crestMinivolley,
};

const CREST_ALT_BY_TEAM: Record<TrainingTeam, string> = {
  u14u15: "Stemma Volley Lignano",
  minivolley: "Logo Volley Lignano S3 Minivolley",
};

export function Logo({
  className,
  variant = "default",
  size = "md",
  showWordmark = true,
  subtitle = "U14 · U15",
  team = "u14u15",
  href = "/",
}: LogoProps) {
  const inverted = variant === "inverted";
  const isMinivolley = team === "minivolley";
  // Su Minivolley la gerarchia si inverte: "Minivolley" grande e in
  // evidenza, "Volley Lignano" piccolo sotto — altrimenti, con "Volley
  // Lignano" sempre in primo piano, è facile scambiarlo per il sito
  // principale (il motivo per cui esiste questo prop team).
  const primaryText = isMinivolley ? "Minivolley" : "Volley Lignano";
  const secondaryText = isMinivolley ? "Volley Lignano" : subtitle;
  return (
    <Link href={href} className={cn("group flex items-center gap-3", className)}>
      <span className={cn("brand-chip shrink-0 transition-transform group-hover:scale-105", CHIP_SIZES[size])}>
        <Image
          src={CREST_BY_TEAM[team]}
          alt={CREST_ALT_BY_TEAM[team]}
          className="h-full w-full object-contain"
          priority
        />
      </span>
      {showWordmark && (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              "font-display text-base font-bold tracking-tight",
              inverted ? "text-white" : "text-foreground",
            )}
          >
            {primaryText}
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.16em]",
              inverted ? "text-sand-200" : "text-sand-600",
            )}
          >
            {secondaryText}
          </span>
        </span>
      )}
    </Link>
  );
}
