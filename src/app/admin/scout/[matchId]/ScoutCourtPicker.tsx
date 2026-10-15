"use client";

import type { ReactNode } from "react";
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
 *
 * Due usi: le finestre «chi?» dopo un punto (`attr="pick"`: si tocca e si chiude) e la finestra della ricezione (`attr="who"`:
 * si seleziona la giocatrice, poi si sceglie il voto).
 */

/** Come si segna la scelta: «pick» sceglie e chiude, «who» seleziona e aspetta il voto (la ricezione). */
export type PickAttr = "pick" | "who";

function SpotCell({
  spot,
  side,
  sorted,
  serving,
  dim,
  selected,
  attr,
  onPick,
}: {
  spot: CourtSpot;
  side: ScoutSide;
  sorted: ScoutPlayer[];
  serving: boolean;
  /** Si vede più spenta (ma si tocca lo stesso): per esempio la seconda linea quando si sceglie chi ha murato. */
  dim: boolean;
  /** Undefined = non si seleziona (si sceglie e basta); altrimenti è la giocatrice scelta adesso. */
  selected: boolean | undefined;
  attr: PickAttr;
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
      {libero && <span className="mt-0.5 text-[9px] font-bold uppercase leading-none tracking-wide opacity-80">libero</span>}
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
      aria-pressed={selected}
      data-scout-pick={attr === "pick" ? player.id : undefined}
      data-scout-who={attr === "who" ? player.id : undefined}
      data-scout-on-court={position}
      data-scout-spot={position}
      className={cn(
        base,
        selected ? (libero ? "border-foreground bg-foreground text-background ring-2 ring-primary ring-offset-2 ring-offset-surface" : "border-primary bg-primary-soft text-foreground ring-2 ring-primary/40") : look,
        "transition-colors active:translate-y-px",
        !selected && (libero ? "hover:bg-foreground/90" : "hover:bg-muted"),
        server && !selected && "ring-2 ring-green-500 ring-offset-2 ring-offset-surface",
        dim && !selected && "opacity-60",
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
  serving = false,
  frontOnly = false,
  selected,
  attr = "pick",
  onPick,
  children,
}: {
  side: ScoutSide;
  court: ScoutCourt;
  /** Tutte le giocatrici della squadra: chi qui non può fare l'azione compare lo stesso, ma non si tocca. */
  roster: ScoutPlayer[];
  /** Chi può fare l'azione che si sta segnando. */
  eligible: ScoutPlayer[];
  /** La squadra batte adesso: il pallone verde sta su chi è in posizione 1. */
  serving?: boolean;
  /** Solo la prima linea (4-3-2) può farla, come a muro: la seconda linea si vede più spenta, ma resta toccabile (la formazione segnata potrebbe non essere aggiornata). */
  frontOnly?: boolean;
  /** Se si seleziona (la ricezione): la scelta di adesso, null = «non so», undefined = nessuna. Se manca si sceglie e basta. */
  selected?: string | null;
  attr?: PickAttr;
  onPick: (id: string) => void;
  /** Sotto il campo (per esempio la panchina). */
  children?: ReactNode;
}) {
  const sorted = sortPlayers(roster);
  const rows = courtSpots(court, roster, eligible);
  const ours = side === "us";
  const selecting = attr === "who";

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
                <SpotCell
                  key={spot.position}
                  spot={spot}
                  side={side}
                  sorted={sorted}
                  serving={serving}
                  dim={frontOnly && spot.back}
                  selected={selecting ? spot.player?.id === selected : undefined}
                  attr={attr}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {frontOnly && <p className="mt-2 text-center text-xs text-muted-foreground">A muro vanno solo le giocatrici davanti (4-3-2); la libero non può murare.</p>}

      {children}
    </div>
  );
}

/**
 * La panchina: chi può fare l'azione e non è in campo (anche la centrale sostituita dalla libero), più chiara.
 * Nella finestra «chi?» sta sotto il campo con il suo titolo; nella ricezione è una riga sola (`inline`),
 * con in testa quello che si passa in `extra` (per esempio «Non so»).
 */
export function CourtBench({
  side,
  court,
  roster,
  eligible,
  selected,
  attr = "pick",
  inline = false,
  extra,
  onPick,
}: {
  side: ScoutSide;
  court: ScoutCourt;
  roster: ScoutPlayer[];
  eligible: ScoutPlayer[];
  /** Se si seleziona (la ricezione): la scelta di adesso. */
  selected?: string | null;
  attr?: PickAttr;
  inline?: boolean;
  extra?: ReactNode;
  onPick: (id: string) => void;
}) {
  const bench = benchOptions(eligible, court);
  if (bench.length === 0 && !extra) return null;
  const sorted = sortPlayers(roster);
  const ours = side === "us";
  const selecting = attr === "who";

  return (
    <div className={cn(!inline && "mt-3")} data-scout-bench={inline ? "inline" : "sheet"}>
      {!inline && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">In panchina</p>}
      <div
        className={cn("grid", inline ? "gap-1" : "grid-cols-4 gap-2")}
        style={inline ? { gridTemplateColumns: "repeat(auto-fill, minmax(3.25rem, 1fr))" } : undefined}
      >
        {extra}
        {bench.map((player) => {
          const active = selecting && selected === player.id;
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onPick(player.id)}
              aria-pressed={selecting ? active : undefined}
              data-scout-pick={attr === "pick" ? player.id : undefined}
              data-scout-who={attr === "who" ? player.id : undefined}
              title={ours ? `${player.name} · in panchina` : "In panchina"}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center rounded-xl border px-1.5 text-center transition-colors active:translate-y-px",
                inline ? "min-h-[2.75rem] py-1 short:min-h-[2.5rem]" : "min-h-[3.5rem] py-1.5",
                active ? "border-primary bg-primary-soft opacity-100 ring-2 ring-primary/40" : "border-dashed border-border-subtle bg-surface opacity-70 hover:bg-muted",
              )}
            >
              <span className={cn("tabular font-display font-extrabold leading-none text-foreground", inline ? "text-lg" : "text-xl")}>{jerseyLabel(player, side)}</span>
              {ours && <span className="mt-0.5 w-full truncate text-[11px] font-semibold leading-tight text-muted-foreground">{shortName(player, sorted)}</span>}
              {player.libero && <span className="absolute right-1 top-0.5 rounded bg-accent px-1 text-[9px] font-bold text-accent-foreground">L</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
