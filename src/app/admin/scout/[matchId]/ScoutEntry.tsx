"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BrickWall, ChevronsDown, CircleX, UserPlus, X, Zap, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { opponentPlayer, type ScoutAction } from "@/lib/scout/actions";
import { orderByCourt } from "@/lib/scout/court";
import type { ScoutCourt, ScoutCourts } from "@/lib/scout/derive";
import { parseJerseyNumbers, shortName, sortPlayers } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import { asksPlayer, canDo, ERROR_HOWS, HOW_META } from "@/lib/scout/rules";
import { otherSide, type ScoutData, type ScoutHow, type ScoutPlayer, type ScoutSide } from "@/lib/scout/types";

/**
 * Dove si segna ogni scambio. Due colonne — «Punto nostro» e «Punto loro» —
 * con i quattro modi in cui finisce uno scambio: attacco, muro, ace o errore
 * dell'altra squadra. Poi si dice chi l'ha fatto, e basta: due tocchi per un
 * punto normale, tre per un errore.
 */

type Step =
  /** Scelta dell'errore: `scorer` è chi ha fatto punto, sbaglia l'altra squadra. */
  | { stage: "error"; scorer: ScoutSide }
  /** Scelta di chi ha compiuto l'azione (`actor`). */
  | { stage: "player"; actor: ScoutSide; how: ScoutHow }
  /** Dopo un muro: chi attaccava (della squadra opposta a `actor`). */
  | { stage: "victim"; actor: ScoutSide; player: string | null };

const POINT_BUTTONS: { how: ScoutHow; hint: string }[] = [
  { how: "attack", hint: "Palla a terra" },
  { how: "block", hint: "Muro vincente" },
  { how: "ace", hint: "Battuta vincente" },
];

/** Un segno per ogni modo di chiudere lo scambio: nelle caselle alte dello schermo intero riempie e si riconosce a colpo d'occhio. */
const POINT_ICONS: Record<string, LucideIcon> = { attack: ChevronsDown, block: BrickWall, ace: Zap, error: CircleX };

function Sheet({
  title,
  subtitle,
  onClose,
  children,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  testId: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/45 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        data-scout-sheet={testId}
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)] sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold leading-tight text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
          </div>
          <Button variant="quiet" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function PlayerButton({
  player,
  side,
  roster,
  position,
  benched,
  onPick,
}: {
  player: ScoutPlayer;
  side: ScoutSide;
  roster: ScoutPlayer[];
  /** Posizione in campo (1…6) se se ne segue la formazione. */
  position?: number | null;
  /** In panchina (si segue la formazione e non è in campo). */
  benched?: boolean;
  onPick: () => void;
}) {
  const ours = side === "us";
  return (
    <button
      type="button"
      onClick={onPick}
      data-scout-pick={player.id}
      data-scout-on-court={position ?? undefined}
      className={cn(
        "relative flex min-h-[4.25rem] min-w-0 flex-col items-center justify-center rounded-xl border border-border-subtle bg-surface px-1.5 py-2 text-center transition-colors hover:bg-muted active:translate-y-px",
        benched && "border-dashed opacity-60",
      )}
    >
      {position ? (
        <span className="absolute left-1.5 top-1 text-[10px] font-bold leading-none text-muted-foreground/80" title={`In campo, posizione ${position}`}>
          {position}
        </span>
      ) : null}
      <span className="tabular font-display text-2xl font-extrabold leading-none text-foreground">
        {player.number ?? (ours ? player.name.trim().slice(0, 1).toUpperCase() : "?")}
      </span>
      {ours && <span className="mt-1 w-full truncate text-[12px] font-semibold text-muted-foreground">{shortName(player, roster)}</span>}
      {player.libero && (
        <span className="absolute right-1.5 top-1 rounded bg-accent px-1 text-[10px] font-bold text-accent-foreground">L</span>
      )}
    </button>
  );
}

/** Chi ha compiuto l'azione, tra le giocatrici della squadra. Per l'avversaria si può aggiungere un numero al volo. */
function PlayerPicker({
  title,
  subtitle,
  side,
  players,
  unknownLabel,
  onPick,
  onPickNew,
  onClose,
  court,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  side: ScoutSide;
  players: ScoutPlayer[];
  unknownLabel: string;
  onPick: (id: string | null) => void;
  onPickNew: (number: string) => void;
  onClose: () => void;
  /** Chi è in campo, se se ne segue la formazione: vengono per prime, con la loro posizione. */
  court?: ScoutCourt | null;
}) {
  const [typed, setTyped] = useState("");
  const sorted = sortPlayers(players);
  const ordered = orderByCourt(players, court ?? null);

  function submitNumber() {
    const [first] = parseJerseyNumbers(typed);
    if (first) onPickNew(first);
  }

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose} testId={`player-${side}`}>
      {sorted.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {ordered.map(({ player, position }) => (
            <PlayerButton
              key={player.id}
              player={player}
              side={side}
              roster={sorted}
              position={position}
              benched={Boolean(court) && position === null}
              onPick={() => onPick(player.id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-muted-foreground">
          {side === "us"
            ? "Non hai ancora scelto le giocatrici: puoi farlo da «Squadre e regole». Intanto puoi segnare il punto senza dire chi."
            : "Non hai ancora scritto i numeri dell'avversaria: scrivine uno qui sotto, oppure segna il punto senza dire chi."}
        </p>
      )}

      {side === "opp" && (
        <div className="mt-3 flex gap-2">
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
            aria-label="Altro numero di maglia"
            data-scout-new-number
            className="min-w-0"
          />
          <Button variant="outline" onClick={submitNumber} disabled={parseJerseyNumbers(typed).length === 0}>
            <UserPlus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>
      )}

      <Button variant="soft" className="mt-4 w-full" onClick={() => onPick(null)} data-scout-pick="unknown">
        {unknownLabel}
      </Button>
    </Sheet>
  );
}

function ErrorPicker({ scorer, onPick, onClose }: { scorer: ScoutSide; onPick: (how: ScoutHow) => void; onClose: () => void }) {
  const groups: { title: string; hows: ScoutHow[] }[] = [
    { title: "Errori di gioco", hows: ERROR_HOWS.filter((how) => HOW_META[how].group === "error") },
    { title: "Falli fischiati dall'arbitro", hows: ERROR_HOWS.filter((how) => HOW_META[how].group === "foul") },
  ];
  return (
    <Sheet
      title={scorer === "us" ? "Errore loro: cosa è successo?" : "Errore nostro: cosa è successo?"}
      subtitle={scorer === "us" ? "Il punto va a noi." : "Il punto va a loro."}
      onClose={onClose}
      testId="error"
    >
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{group.title}</p>
            <div className="grid grid-cols-2 gap-2">
              {group.hows.map((how) => (
                <button
                  key={how}
                  type="button"
                  onClick={() => onPick(how)}
                  data-scout-error={how}
                  title={HOW_META[how].hint}
                  className="flex min-h-[3.25rem] flex-col justify-center rounded-xl border border-border-subtle bg-surface px-3 py-2 text-left transition-colors hover:bg-muted active:translate-y-px sm:min-h-[3.75rem] sm:px-3.5"
                >
                  <span className="text-[14px] font-bold leading-tight text-foreground sm:text-[15px]">{HOW_META[how].label}</span>
                  <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block">{HOW_META[how].hint}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function SideButton({
  side,
  label,
  hint,
  icon: Icon,
  onClick,
  disabled,
  testId,
  compact = false,
}: {
  side: ScoutSide;
  label: string;
  hint: string;
  /** Il segno del pulsante, solo nelle caselle alte dello schermo intero. */
  icon: LucideIcon;
  onClick: () => void;
  disabled: boolean;
  testId: string;
  /**
   * Schermo intero su schermo largo: i quattro pulsanti stanno in due colonne e si allungano a riempire tutta l'altezza
   * che resta (più alti, più facili da toccare), con il testo che cresce insieme all'altezza dello schermo.
   */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-scout-add={testId}
      className={cn(
        "flex min-h-[3.5rem] w-full flex-col justify-center rounded-xl px-3.5 py-2 text-left transition-[background-color,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-45 sm:min-h-[4.75rem]",
        // La casella è il suo contenitore: icona e testi si dimensionano sulla sua altezza (che cresce con lo spazio che c'è) e
        // l'icona compare solo se la casella è alta abbastanza; così nei momenti stretti (ricezione aperta) ne bastano 4,25 rem.
        compact && "h-full min-h-[4.25rem] justify-between px-3 py-2.5 [container-type:size] short:min-h-[3.25rem] short:py-2 sm:min-h-[4.25rem] sm:short:min-h-[3.25rem]",
        side === "us"
          ? "bg-primary-soft text-primary hover:bg-primary-soft-hover"
          : "bg-accent text-accent-foreground hover:bg-accent-hover",
      )}
    >
      {compact && (
        <Icon
          aria-hidden
          className="hidden h-[clamp(1.5rem,19cqh,2.875rem)] w-[clamp(1.5rem,19cqh,2.875rem)] shrink-0 opacity-80 [@container(min-height:6.5rem)]:block"
          strokeWidth={2.25}
        />
      )}
      <span className="block min-w-0">
        <span
          className={cn(
            "block text-[17px] font-extrabold leading-tight sm:text-lg",
            compact && "text-[clamp(15px,11cqh,22px)] sm:text-[clamp(15px,11cqh,22px)]",
          )}
        >
          {label}
        </span>
        <span className={cn("hidden truncate text-xs font-medium opacity-75 sm:block", compact && "mt-0.5 line-clamp-2 whitespace-normal text-[clamp(11px,7.5cqh,15px)] leading-snug")}>{hint}</span>
      </span>
    </button>
  );
}

export function ScoutEntry({
  data,
  locked,
  dispatch,
  courts,
  compact = false,
}: {
  data: ScoutData;
  /** Partita decisa o chiusa: non si aggiunge altro. */
  locked: boolean;
  dispatch: (action: ScoutAction) => void;
  /** Chi è in campo per ogni squadra di cui si segue la formazione. */
  courts?: ScoutCourts;
  /** A schermo intero su schermi larghi: i quattro modi di ogni squadra in due colonne, per stare tutti in vista. */
  compact?: boolean;
}) {
  const [step, setStep] = useState<Step | null>(null);
  const close = () => setStep(null);

  function commit(input: { actor: ScoutSide; how: ScoutHow; player: string | null; victim?: string | null }) {
    dispatch({ type: "rally", input, at: Date.now(), id: newId() });
    setStep(null);
  }

  function pickError(scorer: ScoutSide, how: ScoutHow) {
    const actor = otherSide(scorer);
    if (asksPlayer(how)) setStep({ stage: "player", actor, how });
    else commit({ actor, how, player: null });
  }

  function pickPlayer(actor: ScoutSide, how: ScoutHow, player: string | null) {
    // Dopo un muro si chiede anche chi attaccava (facoltativo): serve agli attacchi murati nel tabellino.
    if (how === "block") setStep({ stage: "victim", actor, player });
    else commit({ actor, how, player });
  }

  /** L'avversaria con quel numero: si aggiunge alla rosa (se non c'è già) e si sceglie subito. */
  function pickNewOpponent(number: string, next: (id: string) => void) {
    const player = opponentPlayer(number);
    dispatch({ type: "addPlayer", side: "opp", player });
    next(player.id);
  }

  function panel(scorer: ScoutSide) {
    const errorLabel = scorer === "us" ? "Errore loro" : "Errore nostro";
    const errorHint = scorer === "us" ? "Sbagliano loro" : "Sbagliamo noi";
    return (
      <div
        data-scout-panel={scorer}
        data-tour={`scout-entry-${scorer}`}
        className={cn(
          "min-w-0 rounded-2xl border border-t-4 bg-card p-2.5 shadow-card sm:p-3.5",
          compact && "flex flex-col sm:p-3",
          scorer === "us" ? "border-border border-t-primary" : "border-border border-t-sand-400",
        )}
      >
        <h2
          className={cn(
            "mb-2.5 px-0.5 font-display text-[17px] font-extrabold leading-none tracking-[-0.01em]",
            compact && "mb-2 text-[clamp(17px,2.4vh,23px)]",
            scorer === "us" ? "text-primary" : "text-accent-foreground",
          )}
        >
          {scorer === "us" ? "Punto nostro" : "Punto loro"}
        </h2>
        <div className={compact ? "grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2" : "space-y-2"}>
          {POINT_BUTTONS.map(({ how, hint }) => (
            <SideButton
              key={how}
              side={scorer}
              compact={compact}
              icon={POINT_ICONS[how]}
              label={HOW_META[how].label}
              hint={hint}
              disabled={locked}
              testId={`${scorer}-${how}`}
              onClick={() => setStep({ stage: "player", actor: scorer, how })}
            />
          ))}
          <SideButton
            side={scorer}
            compact={compact}
            icon={POINT_ICONS.error}
            label={errorLabel}
            hint={errorHint}
            disabled={locked}
            testId={`${scorer}-error`}
            onClick={() => setStep({ stage: "error", scorer })}
          />
        </div>
      </div>
    );
  }

  const eligible = (side: ScoutSide, how: ScoutHow) => data.roster[side].filter((p) => canDo(how, p.libero));

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-2.5 sm:gap-4", compact && "flex-1 gap-3 sm:gap-3")} data-scout-entry>
        {panel("us")}
        {panel("opp")}
      </div>

      {step?.stage === "error" && (
        <ErrorPicker scorer={step.scorer} onPick={(how) => pickError(step.scorer, how)} onClose={close} />
      )}

      {step?.stage === "player" && (
        <PlayerPicker
          title={`${HOW_META[step.how].label}: chi?`}
          subtitle={
            HOW_META[step.how].scores
              ? `Punto ${step.actor === "us" ? "nostro" : "loro"} · ${HOW_META[step.how].hint}`
              : `${step.actor === "us" ? "Errore nostro" : "Errore loro"} · punto ${step.actor === "us" ? "loro" : "nostro"}`
          }
          side={step.actor}
          players={eligible(step.actor, step.how)}
          court={courts?.[step.actor]}
          unknownLabel="Non so / non indicare"
          onPick={(id) => pickPlayer(step.actor, step.how, id)}
          onPickNew={(number) => pickNewOpponent(number, (id) => pickPlayer(step.actor, step.how, id))}
          onClose={close}
        />
      )}

      {step?.stage === "victim" && (
        <PlayerPicker
          title="Chi attaccava?"
          subtitle="Il muro ha fermato l'attacco di… (facoltativo)"
          side={otherSide(step.actor)}
          players={data.roster[otherSide(step.actor)]}
          court={courts?.[otherSide(step.actor)]}
          unknownLabel="Non so / salta"
          onPick={(id) => commit({ actor: step.actor, how: "block", player: step.player, victim: id })}
          onPickNew={(number) =>
            pickNewOpponent(number, (id) => commit({ actor: step.actor, how: "block", player: step.player, victim: id }))
          }
          onClose={close}
        />
      )}
    </>
  );
}
