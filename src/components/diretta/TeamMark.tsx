"use client";

import { useState } from "react";
import Image from "next/image";
import crest from "@/assets/lignano-crest.png";
import { cn } from "@/lib/cn";
import { readableTextColor, teamMonogram } from "@/lib/liveScore";
import type { Side } from "@/lib/diretta/overlayEvents";
import type { PublicLiveScoreTeam } from "@/lib/types";
import { SUN } from "./theme";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Il colore scelto dal coach per la squadra, solo se è un esadecimale valido. */
export const accent = (color: string) => (HEX.test(color) ? color : "#475569");

/**
 * Il colore di una squadra sopra i riquadri azzurri della grafica: per Lignano il giallo dello stemma (il suo blu, sull'azzurro,
 * non si vedrebbe), per l'avversaria il colore scelto dal coach.
 */
export const tone = (side: Side, color: string) => (side === "home" ? SUN : accent(color));

/**
 * Il logo di una squadra nelle grafiche della diretta: lo stemma del sito per Lignano; per l'avversaria il logo del girone
 * (quando la risposta del punteggio ne porta uno e l'immagine si carica), altrimenti il tondo con le iniziali nel colore scelto
 * dal coach. `className` dà le misure, in rem come il resto della grafica.
 */
export function TeamMark({ team, side, className }: { team: PublicLiveScoreTeam; side: Side; className?: string }) {
  // Il logo che non si è caricato: finché la risposta ne porta un altro si riprova, per quello si ricorda quale.
  const [failed, setFailed] = useState<string | null>(null);
  const tile = cn("grid shrink-0 place-items-center overflow-hidden rounded-[0.6rem] bg-white p-[0.3rem]", className);

  if (side === "home") {
    return (
      <span className={tile} data-grafica-logo="home">
        <Image src={crest} alt="" unoptimized className="h-full w-full object-contain" />
      </span>
    );
  }

  const logo = team.logo ?? null;
  if (logo && failed !== logo) {
    return (
      <span className={tile} data-grafica-logo="away">
        {/* Immagine già ridotta e tenuta in cache dal nostro server: next/image non serve. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setFailed(logo)}
          // Se l'errore è arrivato prima che la pagina fosse pronta, l'evento si perde: si ricontrolla qui.
          ref={(img) => {
            if (img && img.complete && img.naturalWidth === 0) setFailed(logo);
          }}
        />
      </span>
    );
  }

  const color = accent(team.color);
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-display text-[1rem] font-extrabold", className)}
      style={{ background: color, color: readableTextColor(color) }}
      data-grafica-logo="monogram"
    >
      {teamMonogram(team.name)}
    </span>
  );
}
