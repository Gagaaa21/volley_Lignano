"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import crest from "@/assets/lignano-crest.png";
import { initialsOf } from "@/lib/federation/teamName";

interface TeamLogoProps {
  /** Indirizzo del logo sul portale della federazione (passa dal nostro sito). */
  src?: string | null;
  name: string;
  /** La nostra squadra usa lo stemma del sito, non il logo del portale. */
  ours?: boolean;
  className?: string;
}

const CHIP = "grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white";

/**
 * Logo di una squadra in classifica. Se il logo manca o non si carica si
 * mostrano le iniziali, così la riga non resta mai con un'immagine rotta.
 * Il nome è già scritto accanto: l'immagine è solo decorativa.
 */
export function TeamLogo({ src, name, ours = false, className }: TeamLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (ours) {
    return (
      <span className={cn(CHIP, "p-1 shadow-xs", className)}>
        <Image src={crest} alt="" className="h-full w-full object-contain" sizes="40px" />
      </span>
    );
  }

  const proxied = src ? `/api/federation/logo?u=${encodeURIComponent(src)}` : null;
  if (!proxied || failedSrc === proxied) {
    return (
      <span
        className={cn(
          CHIP,
          "bg-muted text-[10px] font-bold tracking-tight text-muted-foreground sm:text-[11px]",
          className,
        )}
        aria-hidden
      >
        {initialsOf(name)}
      </span>
    );
  }

  return (
    <span className={cn(CHIP, "p-0.5", className)}>
      {/* Immagine esterna già ridotta e messa in cache dal nostro server: next/image non serve. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxied}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
        onError={() => setFailedSrc(proxied)}
        // Se l'errore è avvenuto prima che la pagina fosse pronta, l'evento si perde: si ricontrolla qui.
        ref={(img) => {
          if (img && img.complete && img.naturalWidth === 0) setFailedSrc(proxied);
        }}
      />
    </span>
  );
}
