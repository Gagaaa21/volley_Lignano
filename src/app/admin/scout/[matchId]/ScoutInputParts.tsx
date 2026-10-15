"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { GRADE_FILL, GradeDot } from "@/components/scout/GradeChart";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { COURT_ROWS, orderByCourt } from "@/lib/scout/court";
import type { ScoutCourt } from "@/lib/scout/derive";
import { parseJerseyNumbers, shortName, sortPlayers } from "@/lib/scout/describe";
import { gradeSymbol, TOUCH_SKILLS } from "@/lib/scout/touches";
import type { ScoutGrade, ScoutPlayer, ScoutRoster, ScoutSide, ScoutTouch, ScoutTouchSkill } from "@/lib/scout/types";

/**
 * I pezzi con cui si segna un tocco (ricezione, o ogni tocco nel livello
 * Completo): chi, il voto, la zona. Sono gli stessi nella striscia della
 * ricezione e nella schermata completa, così si imparano una volta.
 */

/** Schermo intero su schermo largo: più di così le tessere diventano troppo strette per il nome. */
const DENSE_MAX_PER_ROW = 10;

/**
 * Le giocatrici di una squadra, da toccare. `selected`: undefined = nessuna
 * scelta, null = «non so». Toccare la giocatrice già scelta (per esempio quella
 * proposta da sola per la battuta) la conferma: per cambiare basta toccarne un'altra.
 */
export function PlayerChips({
  side,
  players,
  selected,
  onSelect,
  onAddNumber,
  ariaLabel,
  court,
  dense = false,
}: {
  side: ScoutSide;
  players: ScoutPlayer[];
  selected: string | null | undefined;
  onSelect: (id: string | null) => void;
  /** Solo per l'avversaria: aggiunge al volo un numero di maglia che non c'è ancora. */
  onAddNumber?: (number: string) => void;
  ariaLabel: string;
  /** Chi è in campo, se se ne segue la formazione: le giocatrici in campo vengono per prime, con la loro posizione. */
  court?: ScoutCourt | null;
  /** Schermo intero su schermo largo: tessere più basse, in una o due righe di pari larghezza, per non perdere altezza. */
  dense?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const sorted = sortPlayers(players);
  const ours = side === "us";
  // Tessere compatte: una riga se sono al massimo 10 («Non so» compreso), altrimenti due (o più) righe di pari larghezza,
  // così i nomi restano leggibili e l'altezza è sempre la minima.
  const chipCount = players.length + 1;
  const denseColumns = Math.ceil(chipCount / Math.ceil(chipCount / DENSE_MAX_PER_ROW));

  function submitNumber() {
    const [first] = parseJerseyNumbers(typed);
    if (!first || !onAddNumber) return;
    onAddNumber(first);
    setTyped("");
  }

  return (
    <div className="space-y-2">
      <div
        className={cn("grid", dense ? "gap-1" : "gap-1.5 grid-cols-5 sm:grid-cols-6")}
        style={dense ? { gridTemplateColumns: `repeat(${denseColumns}, minmax(0, 1fr))` } : undefined}
        role="group"
        aria-label={ariaLabel}
        data-scout-chips
        data-scout-dense={dense ? "" : undefined}
      >
        {orderByCourt(players, court ?? null).map(({ player, position }) => {
          const active = selected === player.id;
          const benched = Boolean(court) && position === null;
          return (
            <button
              key={player.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(player.id)}
              data-scout-who={player.id}
              data-scout-on-court={position ?? undefined}
              className={cn(
                "relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-colors active:translate-y-px",
                dense && "min-h-[2.75rem] py-1",
                active
                  ? ours
                    ? "border-primary bg-primary-soft ring-2 ring-primary/30"
                    : "border-sand-400 bg-accent ring-2 ring-sand-400/40"
                  : "border-border-subtle bg-surface hover:bg-muted",
                benched && !active && "border-dashed opacity-60",
              )}
            >
              {position !== null && (
                <span className="absolute left-1 top-0.5 text-[9px] font-bold leading-none text-muted-foreground/80" title={`In campo, posizione ${position}`}>
                  {position}
                </span>
              )}
              <span className="tabular font-display text-xl font-extrabold leading-none text-foreground">
                {player.number ?? (ours ? player.name.trim().slice(0, 1).toUpperCase() : "?")}
              </span>
              {ours && <span className={cn("mt-0.5 w-full truncate text-[11px] font-semibold text-muted-foreground", dense && "leading-tight")}>{shortName(player, sorted)}</span>}
              {player.libero && <span className="absolute right-1 top-0.5 rounded bg-accent px-1 text-[9px] font-bold text-accent-foreground">L</span>}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
          data-scout-who="unknown"
          className={cn(
            "flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed px-1 py-1.5 text-center transition-colors active:translate-y-px",
            dense && "min-h-[2.75rem] py-1",
            selected === null ? "border-primary bg-primary-soft ring-2 ring-primary/30" : "border-border-strong bg-surface hover:bg-muted",
          )}
        >
          <span className="font-display text-xl font-extrabold leading-none text-muted-foreground">?</span>
          <span className={cn("mt-0.5 text-[11px] font-semibold text-muted-foreground", dense && "leading-tight")}>Non so</span>
        </button>
      </div>

      {sorted.length === 0 && (
        <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
          {ours ? "Non hai ancora scelto le giocatrici: puoi farlo da «Squadre e regole». Intanto scegli «Non so»." : "Scrivi qui sotto un numero di maglia dell'avversaria, oppure scegli «Non so»."}
        </p>
      )}

      {onAddNumber && (
        <div className="flex gap-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNumber();
              }
            }}
            inputMode="numeric"
            placeholder="Altro numero di maglia"
            aria-label="Altro numero di maglia dell'avversaria"
            data-scout-new-number
            className="min-w-0"
          />
          <Button variant="outline" size="sm" onClick={submitNumber} disabled={parseJerseyNumbers(typed).length === 0}>
            <UserPlus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>
      )}
    </div>
  );
}

/** I pulsanti dei voti di un fondamentale, dal migliore al peggiore; il nome del voto cambia col fondamentale. */
export function GradeButtons({
  skill,
  onPick,
  disabled,
  testId,
  compact = false,
}: {
  skill: ScoutTouchSkill;
  onPick: (grade: ScoutGrade) => void;
  disabled?: boolean;
  testId?: string;
  /** Schermo intero su schermo largo: sugli schermi bassi i pulsanti sono un po' meno alti. */
  compact?: boolean;
}) {
  const meta = TOUCH_SKILLS[skill];
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${meta.grades.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label={`Voto: ${meta.label.toLowerCase()}`}
      data-scout-grades={testId ?? skill}
    >
      {meta.grades.map((grade) => (
        <button
          key={grade}
          type="button"
          disabled={disabled}
          onClick={() => onPick(grade)}
          data-scout-grade={grade}
          title={meta.gradeHints[grade]}
          aria-label={`${gradeSymbol(grade)} ${meta.gradeLabels[grade] ?? ""}. ${meta.gradeHints[grade] ?? ""}`}
          className={cn(
            "flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 text-center ring-1 ring-inset ring-foreground/10 transition-[transform,opacity] active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
            compact && "short:min-h-[3rem] short:py-1",
            GRADE_FILL[grade],
          )}
        >
          <span className="font-display text-xl font-extrabold leading-none">{gradeSymbol(grade)}</span>
          <span className="mt-0.5 max-w-full truncate text-[10.5px] font-bold leading-tight sm:text-xs">{meta.gradeLabels[grade]}</span>
        </button>
      ))}
    </div>
  );
}

/** Le sei zone del campo, come si vedono dalla propria metà (davanti 4-3-2, dietro 5-6-1); toccare di nuovo la stessa la toglie. */
export function ZonePicker({
  value,
  onChange,
  label,
  className,
}: {
  value: number | null;
  onChange: (zone: number | null) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-[13rem]", className)} role="group" aria-label={label} data-scout-zones>
      <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Rete</p>
      <div className="grid gap-1">
        {COURT_ROWS.map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-1">
            {row.map((zone) => (
              <button
                key={zone}
                type="button"
                aria-pressed={value === zone}
                aria-label={`Zona ${zone}`}
                onClick={() => onChange(value === zone ? null : zone)}
                data-scout-zone-pick={zone}
                className={cn(
                  "tabular h-9 rounded-lg border text-sm font-bold transition-colors active:translate-y-px",
                  value === zone ? "border-primary bg-primary text-primary-foreground" : "border-border-subtle bg-surface text-foreground hover:bg-muted",
                )}
              >
                {zone}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Un tocco in piccolo: la lettera del fondamentale, chi e il voto. */
export function TouchChip({ touch, roster }: { touch: ScoutTouch; roster: ScoutRoster }) {
  const meta = TOUCH_SKILLS[touch.skill];
  const player = touch.player ? roster[touch.side].find((p) => p.id === touch.player) : undefined;
  const who = player ? (player.number ?? (touch.side === "us" ? player.name.trim().slice(0, 1).toUpperCase() : "?")) : "?";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-1.5 text-xs font-bold",
        touch.side === "us" ? "border-primary/30 bg-primary-soft text-primary" : "border-sand-400/60 bg-accent text-accent-foreground",
      )}
      data-scout-touch-chip={`${touch.skill}:${touch.grade}`}
      title={`${meta.label} · ${touch.side === "us" ? "noi" : "loro"} · ${player ? player.name : "non so chi"} · ${meta.gradeLabels[touch.grade] ?? gradeSymbol(touch.grade)}`}
    >
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-foreground/10 text-[10px] font-extrabold">{meta.letter}</span>
      <span className="tabular">{who}</span>
      <GradeDot grade={touch.grade} size="sm" />
    </span>
  );
}
