import { format, isValid, parseISO } from "date-fns";
import { Clock, Flame, Users } from "lucide-react";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLiveScore, PublicPregame } from "@/lib/types";
import { DROP, EDGE, GLASS, GLASS_DARK, GOLD, INK, SUN, SUNSET, tag } from "./theme";
import { TeamMark } from "./TeamMark";

/**
 * Il banner in alto, al centro, prima del fischio d'inizio (niente punteggio): «Riscaldamento in corso», da 15 minuti prima
 * «Inizio riscaldamento ufficiale», durante la presentazione (tra una grafica e l'altra) «Presentazione delle squadre».
 * Accanto, le due squadre con i loghi e l'ora d'inizio. Stessi materiali della barra; si apre a tendina.
 */
const LABELS: Record<Exclude<PublicPregame, "cover">, string> = {
  warmup: "Riscaldamento in corso",
  officialWarmup: "Inizio riscaldamento ufficiale",
  protocol: "Presentazione delle squadre",
};

/** «18:00» dall'orario della partita (ora italiana, senza fuso), o null. */
function startTime(live: PublicLiveScore): string | null {
  if (!live.info?.date) return null;
  const date = parseISO(live.info.date);
  return isValid(date) ? format(date, "HH:mm") : null;
}

export function PregameBanner({ live, phase }: { live: PublicLiveScore; phase: Exclude<PublicPregame, "cover"> }) {
  const time = startTime(live);
  const official = phase === "officialWarmup";
  const Icon = phase === "protocol" ? Users : Flame;
  return (
    <div
      key={phase}
      className="flex items-stretch text-white"
      style={{ filter: DROP, animation: "grafica-wipe-in 600ms cubic-bezier(.2,.8,.2,1) both" }}
      data-grafica-pregame={phase}
    >
      <span
        className="grafica-type relative z-10 flex items-center gap-[0.7rem] py-[0.9rem] pl-[1.8rem] pr-[2.4rem] text-[1.9rem] tracking-[0.05em]"
        style={{ background: official ? SUNSET : GOLD, color: INK, clipPath: tag("1.1rem") }}
        data-grafica-pregame-label
      >
        <Icon className="h-[1.9rem] w-[1.9rem]" aria-hidden />
        {LABELS[phase]}
      </span>
      <span className="-ml-[1rem] flex items-center gap-[1rem] pl-[2.4rem] pr-[2rem]" style={{ background: GLASS, boxShadow: EDGE, clipPath: tag("1.1rem") }}>
        <TeamMark team={live.home} side="home" className="h-[2.6rem] w-[2.6rem] rounded-[0.5rem]" />
        <span className="grafica-type text-[1.7rem] tracking-[0.03em]">{teamShortName(live.home.name)}</span>
        <span className="grafica-type text-[1.4rem]" style={{ color: SUN }}>
          –
        </span>
        <span className="grafica-type text-[1.7rem] tracking-[0.03em]">{teamShortName(live.away.name)}</span>
        <TeamMark team={live.away} side="away" className="h-[2.6rem] w-[2.6rem] rounded-[0.5rem]" />
      </span>
      {time && (
        <span
          className="grafica-type -ml-[1rem] flex items-center gap-[0.5rem] pl-[2.2rem] pr-[1.8rem] text-[1.5rem] tracking-[0.06em]"
          style={{ background: GLASS_DARK, boxShadow: EDGE, clipPath: tag("1.1rem") }}
          data-grafica-pregame-time
        >
          <Clock className="h-[1.5rem] w-[1.5rem]" style={{ color: SUN }} aria-hidden />
          Inizio ore {time}
        </span>
      )}
    </div>
  );
}
