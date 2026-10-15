"use client";

import { Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import { benchOptions, courtSpots, jerseyLabel, type CourtSpot } from "@/lib/scout/court";
import type { ScoutCourt } from "@/lib/scout/derive";
import { shortName, sortPlayers } from "@/lib/scout/describe";
import type { ScoutPlayer, ScoutSide } from "@/lib/scout/types";

/**
 * «Chi?» si sceglie dal campo: la metà campo della squadra come la si vede dalla sua parte, con la rete in alto
 * (davanti 4-3-2, dietro 5-6-1), la libero in scuro, il pallone verde su chi batte e, sotto, la panchina.
 * Si tocca la giocatrice dove sta sul campo: è lo stesso disegno di «In campo», così si riconosce a colpo d'occhio.
 */

function SpotCell({
  spot,
  side,
  sorted,
  serving,
  dim,
  onPick,
}: {
  spot: CourtSpot;
  side: ScoutSide;
  sorted: ScoutPlayer[];
  serving: boolean;
  /** Si vede più spenta (ma si tocca lo stesso): per esempio la seconda linea quando si sceglie chi ha murato. */
  dim: boolean;
  onPick: (id: string) => void;
}) {
  const { position, player, libero, pickable } = spot;
  const base = "relative flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center";
  const corner = "absolute left-1.5 top-1 text-[10px] font-bold leading-none opacity-70";

  if (!player) {
    return (
      <div
        data-scout-spot={position}
        title={`Posizione ${position}: vuota`}
        className={cn(base, "border-dashed border-border-strong bg-surface/60 text-muted-foreground/60")}
      >
        <span className={corner}>{position}</span>
        <span className="font-display text-2xl font-extrabold leading-none">–</span>
      </div>
    );
  }

  const server = serving && position === 1;
  const face = (
    <>
      <span className={corner}>{position}</span>
      <span className="tabular font-display text-3xl font-extrabold leading-none">{jerseyLabel(player, side)}</span>
      {side === "us" && <span className="mt-1 w-full truncate text-[12px] font-semibold leading-tight opacity-80">{shortName(player, sorted)}</span>}
      {libero && <span className="absolute bottom-1 text-[9px] font-bold uppercase leading-none tracking-wide opacity-80">libero</span>}
      {server && (
        <span className="absolute -right-1 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-green-500 text-white shadow-sm" aria-label="Batte">
          <Volleyball className="h-3 w-3" />
        </span>
      )}
    </>
  );
  const look = libero ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground";

  if (!pickable) {
    return (
      <div
        data-scout-spot={position}
        aria-disabled
        title={libero ? "La libero non può murare" : "Non può fare questa azione"}
        className={cn(base, look, "opacity-40")}
      >
        {face}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPick(player.id)}
      data-scout-pick={player.id}
      data-scout-on-court={position}
      data-scout-spot={position}
      className={cn(
        base,
        look,
        "transition-colors active:translate-y-px",
        libero ? "hover:bg-foreground/90" : "hover:bg-muted",
        server && "ring-2 ring-green-500 ring-offset-2 ring-offset-surface",
        dim && "opacity-60",
      )}
    >
      {face}
    </button>
  );
}

export function CourtPicker({
  side,
  court,
  roster,
  eligible,
  serving,
  frontOnly = false,
  onPick,
}: {
  side: ScoutSide;
  court: ScoutCourt;
  /** Tutte le giocatrici della squadra: chi qui non può fare l'azione compare lo stesso, ma non si tocca. */
  roster: ScoutPlayer[];
  /** Chi può fare l'azione che si sta segnando. */
  eligible: ScoutPlayer[];
  /** La squadra batte adesso: il pallone verde sta su chi è in posizione 1. */
  serving: boolean;
  /** Solo la prima linea (4-3-2) può farla, come a muro: la seconda linea si vede più spenta, ma resta toccabile (la formazione segnata potrebbe non essere aggiornata). */
  frontOnly?: boolean;
  onPick: (id: string) => void;
}) {
  const sorted = sortPlayers(roster);
  const rows = courtSpots(court, roster, eligible);
  const bench = benchOptions(eligible, court);
  const ours = side === "us";

  return (
    <div>
      <div
        role="group"
        aria-label={`Campo ${ours ? "nostro" : "loro"}: tocca la giocatrice`}
        data-scout-court-picker={side}
        className={cn("rounded-2xl border p-2.5 sm:p-3", ours ? "border-primary/25 bg-primary-soft/60" : "border-sand-400/50 bg-accent/50")}
      >
        {/* La rete: la prima linea le sta accanto. */}
        <div className="relative mb-2.5 flex items-center justify-center" aria-hidden>
          <span className="absolute inset-x-0 h-2 rounded-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.92)_0_6px,rgba(9,26,38,0.88)_6px_12px)] shadow-[0_0_0_1px_rgba(9,26,38,0.25)]" />
          <span className="relative rounded-full bg-surface px-2.5 text-[10px] font-bold uppercase leading-4 tracking-[0.18em] text-muted-foreground shadow-[0_0_0_1px_rgba(9,26,38,0.12)]">Rete</span>
        </div>

        {rows.map((row, index) => (
          <div key={index}>
            {index === 1 && (
              <div className="my-2 flex items-center gap-2" aria-hidden>
                <span className="h-0 flex-1 border-t-2 border-dashed border-foreground/15" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">linea dei 3 m</span>
                <span className="h-0 flex-1 border-t-2 border-dashed border-foreground/15" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2" data-scout-court-row={index === 0 ? "front" : "back"}>
              {row.map((spot) => (
                <SpotCell key={spot.position} spot={spot} side={side} sorted={sorted} serving={serving} dim={frontOnly && spot.back} onPick={onPick} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {frontOnly && <p className="mt-2 text-center text-xs text-muted-foreground">A muro vanno solo le giocatrici davanti (4-3-2); la libero non può murare.</p>}

      {bench.length > 0 && (
        <div className="mt-3" data-scout-bench>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">In panchina</p>
          <div className="grid grid-cols-4 gap-2">
            {bench.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onPick(player.id)}
                data-scout-pick={player.id}
                className="relative flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-surface px-1.5 py-1.5 text-center opacity-70 transition-colors hover:bg-muted active:translate-y-px"
              >
                <span className="tabular font-display text-xl font-extrabold leading-none text-foreground">{jerseyLabel(player, side)}</span>
                {ours && <span className="mt-0.5 w-full truncate text-[11px] font-semibold leading-tight text-muted-foreground">{shortName(player, sorted)}</span>}
                {player.libero && <span className="absolute right-1 top-0.5 rounded bg-accent px-1 text-[9px] font-bold text-accent-foreground">L</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
