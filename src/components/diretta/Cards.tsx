import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { secondsLeft, TIMEOUT_CARD_MS, type Card } from "@/lib/diretta/overlayEvents";
import type { PublicLiveScore } from "@/lib/types";

/**
 * Le schede che si aprono sotto la barra del punteggio (sopra, se la barra sta in basso): time-out con il conto alla
 * rovescia, fine set e finale. Il conto alla rovescia parte quando la grafica si accorge del time-out, qualche secondo dopo
 * che lo Scout lo ha segnato: è indicativo.
 */

/** Gli ultimi istanti la scheda si dissolve, invece di sparire di colpo. */
const FADE_MS = 300;

function Frame({ card, now, children, kind }: { card: Card; now: number; children: ReactNode; kind: Card["kind"] }) {
  const leaving = card.until - now < FADE_MS;
  return (
    <div
      className={cn(
        "w-[40rem] animate-[grafica-card-in_350ms_ease-out] overflow-hidden rounded-[0.7rem] text-white shadow-[0_0.6rem_1.6rem_rgba(0,0,0,0.45)] transition-opacity duration-300",
        leaving && "opacity-0",
      )}
      style={{ backgroundColor: "#06141f" }}
      data-grafica-card={kind}
    >
      {children}
    </div>
  );
}

const label = "flex h-full items-center px-[1rem] font-display text-[1.05rem] font-extrabold uppercase tracking-[0.14em]";

export function GraficaCard({ card, live, now }: { card: Card; live: PublicLiveScore; now: number }) {
  if (card.kind === "timeout") {
    const team = card.side === "home" ? live.home : live.away;
    return (
      <Frame card={card} now={now} kind="timeout">
        <div className="flex h-[3rem] items-stretch">
          <span className={cn(label, "bg-amber-400 text-[#06141f]")}>Time-out</span>
          <span className="flex min-w-0 flex-1 items-center px-[1rem]">
            <span className="truncate font-display text-[1.3rem] font-extrabold uppercase tracking-wide">{team.name}</span>
          </span>
          <span className="flex items-center px-[1rem] font-display text-[1.7rem] font-extrabold tabular-nums" data-grafica-countdown>
            0:{String(secondsLeft(card, now)).padStart(2, "0")}
          </span>
        </div>
        <div className="h-[0.3rem] w-full bg-white/10">
          <div
            key={card.startedAt}
            className="h-full origin-left bg-amber-400"
            style={{ animation: `grafica-countdown ${TIMEOUT_CARD_MS}ms linear forwards` }}
          />
        </div>
      </Frame>
    );
  }

  if (card.kind === "set") {
    const homeWon = card.home > card.away;
    return (
      <Frame card={card} now={now} kind="set">
        <div className="flex h-[3rem] items-stretch">
          <span className={cn(label, "bg-white/15")}>Fine {card.n}° set</span>
          <span className="flex min-w-0 flex-1 items-center justify-end gap-[1rem] px-[1rem] font-display text-[1.5rem] font-extrabold uppercase tabular-nums">
            <span className="truncate text-[1.1rem] tracking-wide">{(homeWon ? live.home : live.away).name}</span>
            <span data-grafica-set-score>
              {card.home}–{card.away}
            </span>
          </span>
        </div>
      </Frame>
    );
  }

  const winner = live.home.sets === live.away.sets ? null : live.home.sets > live.away.sets ? live.home : live.away;
  return (
    <Frame card={card} now={now} kind="final">
      <div className="flex h-[3rem] items-stretch">
        <span className={cn(label, "bg-emerald-400 text-[#06141f]")}>Finale</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-[1rem] px-[1rem] font-display text-[1.5rem] font-extrabold uppercase tabular-nums">
          <span className="truncate text-[1.1rem] tracking-wide">{winner ? `Vince ${winner.name}` : "Partita finita"}</span>
          <span data-grafica-final-score>
            {live.home.sets}–{live.away.sets}
          </span>
        </span>
      </div>
    </Frame>
  );
}
