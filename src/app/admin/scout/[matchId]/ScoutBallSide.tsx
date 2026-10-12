import { Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BallState } from "@/lib/scout/phases";
import type { ScoutSide } from "@/lib/scout/types";

/** I colori di una squadra, uguali in tutto lo Scout: noi in azzurro, loro in sabbia. */
const ACTIVE: Record<ScoutSide, string> = {
  us: "bg-primary text-primary-foreground",
  opp: "bg-sand-400 text-sand-900",
};
const IDLE: Record<ScoutSide, string> = {
  us: "bg-primary-soft text-primary/55",
  opp: "bg-accent text-accent-foreground/55",
};

/** Una metà campo: dalla parte della palla dice di chi è e che fase si gioca, dall'altra solo il nome della squadra. */
function Half({ side, ball }: { side: ScoutSide; ball: BallState }) {
  const active = ball.side === side;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center px-3.5 transition-colors duration-300 sm:px-5",
        side === "opp" && "items-end text-right",
        active ? ACTIVE[side] : IDLE[side],
      )}
    >
      {active ? (
        <>
          <span className="truncate text-[11px] font-extrabold uppercase leading-tight tracking-[0.04em] sm:text-sm sm:tracking-[0.1em]">
            Palla {side === "us" ? "nostra" : "loro"}
          </span>
          <span className="truncate text-[11px] font-semibold leading-tight opacity-90 sm:text-xs">{ball.phase}</span>
        </>
      ) : (
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{side === "us" ? "Noi" : "Loro"}</span>
      )}
    </div>
  );
}

/**
 * Il campo visto dall'alto, con «Noi» a sinistra e «Loro» a destra e la rete in
 * mezzo: la palla sta dalla parte di chi ha il tocco o la battuta e si sposta da
 * sola, passando la rete, ogni volta che cambia. Così, senza leggere niente, si
 * vede subito da che lato del campo è. Resta in vista mentre si scorre fino ai
 * pulsanti: subito sotto l'intestazione del sito o, a schermo intero, in cima.
 */
export function ScoutBallSide({ ball, fullscreen = false }: { ball: BallState; fullscreen?: boolean }) {
  const onUs = ball.side === "us";
  return (
    <div
      role="status"
      aria-label={`La palla è ${onUs ? "dalla nostra parte" : "dalla parte loro"}: ${ball.phase}`}
      data-scout-ball
      data-scout-ball-side={ball.side}
      data-tour="scout-ball"
      className={cn(
        "sticky z-30 grid h-14 grid-cols-2 overflow-hidden rounded-2xl border-2 shadow-raised transition-colors duration-300 [--ball:2.5rem] sm:h-[4.75rem] sm:[--ball:2.75rem]",
        onUs ? "border-primary" : "border-sand-400",
      )}
      style={{ top: fullscreen ? 0 : "var(--admin-header-h, 0px)" }}
    >
      <Half side="us" ball={ball} />
      <Half side="opp" ball={ball} />
      {/* La rete, a righe bianche e scure come quella del Live score. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 z-10 w-2 -translate-x-1/2 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.92)_0_5px,rgba(9,26,38,0.88)_5px_10px)] shadow-[0_0_0_1px_rgba(9,26,38,0.25)]"
      />
      {/* La palla: accanto alla rete, dalla parte in cui si trova. Cambiando parte scivola dall'altra. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 z-20 grid h-[var(--ball)] w-[var(--ball)] -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_6px_16px_-4px_rgba(9,26,38,0.6)] ring-4 transition-[left] duration-500 ease-out",
          onUs ? "ring-primary/35" : "ring-sand-300/80",
        )}
        style={{ left: onUs ? "calc(50% - var(--ball) - 0.625rem)" : "calc(50% + 0.625rem)" }}
      >
        <Volleyball className="h-5 w-5 animate-[scout-ball-bounce_1.1s_ease-in-out_infinite] text-sea-950 motion-reduce:animate-none sm:h-6 sm:w-6" />
      </span>
    </div>
  );
}
