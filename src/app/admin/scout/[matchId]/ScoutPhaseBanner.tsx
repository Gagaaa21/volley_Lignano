"use client";

import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { playerLabel } from "@/lib/scout/describe";
import { PHASE_FLOW, PHASE_STEPS } from "@/lib/scout/phases";
import { TOUCH_SKILLS, type NextTouch, type PhaseHint } from "@/lib/scout/touches";
import type { ScoutRoster, ScoutSide, ScoutTouch } from "@/lib/scout/types";
import { TouchChip } from "./ScoutInputParts";

/** Il colore di una squadra, uguale in tutto lo Scout: noi in azzurro, loro in sabbia. */
const NOW_STYLE: Record<ScoutSide, string> = {
  us: "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25",
  opp: "border-sand-400 bg-sand-400 text-sand-900 shadow-sm ring-2 ring-sand-400/40",
};
const NEXT_STYLE: Record<ScoutSide, string> = {
  us: "border-dashed border-primary/40 bg-transparent text-primary/70",
  opp: "border-dashed border-sand-400 bg-transparent text-accent-foreground/70",
};
const CARD_STYLE: Record<ScoutSide, string> = {
  us: "border-primary bg-primary-soft/60",
  opp: "border-sand-400 bg-accent/60",
};

/** Una fase: la lettera del fondamentale, il nome e di chi è. Piena = tocca adesso, tratteggiata = di solito viene dopo. */
function PhaseChip({ touch, state }: { touch: NextTouch; state: "now" | "next" }) {
  const meta = TOUCH_SKILLS[touch.skill];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs font-bold",
        state === "now" ? NOW_STYLE[touch.side] : NEXT_STYLE[touch.side],
      )}
      data-scout-phase-chip={`${touch.skill}:${touch.side}`}
      data-scout-phase-state={state}
    >
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-foreground/10 text-[10px] font-extrabold">{meta.letter}</span>
      {meta.label}
      <span className="text-[10px] font-semibold opacity-80">{touch.side === "us" ? "noi" : "loro"}</span>
    </span>
  );
}

/** Tra due fasi: una freccia, o la rete se la palla passa dall'altra parte. */
function Link({ crossesNet }: { crossesNet: boolean }) {
  return (
    <li aria-hidden className="flex items-center text-muted-foreground/60" data-scout-phase-link={crossesNet ? "net" : "same"}>
      {crossesNet ? <span className="mx-0.5 h-5 border-l-2 border-dashed border-muted-foreground/50" title="La palla passa la rete" /> : <span className="text-xs">›</span>}
    </li>
  );
}

/**
 * La palla in questo scambio: i tocchi già segnati, quello che tocca adesso
 * (pieno e colorato, con il perché) e le fasi che di solito seguono (tratteggiate).
 * Quando la palla passa dall'altra parte compare la rete. Sotto, in due righe, come
 * funziona l'alternarsi delle fasi per chi non lo ricorda.
 */
export function ScoutPhaseBanner({
  pending,
  roster,
  hint,
  serverId,
  locked,
}: {
  pending: readonly ScoutTouch[];
  roster: ScoutRoster;
  hint: PhaseHint;
  /** La giocatrice in battuta, se se ne segue la formazione. */
  serverId?: string;
  locked: boolean;
}) {
  const { next } = hint;
  const meta = TOUCH_SKILLS[next.skill];
  const last = pending[pending.length - 1];
  const who = next.skill === "serve" && serverId && pending.length === 0 ? playerLabel(roster, next.side, serverId) : null;
  const sequence: NextTouch[] = locked ? [] : [next, ...hint.after];
  return (
    <div className="space-y-2.5" data-scout-phase-banner>
      <ol className="flex min-h-[1.75rem] flex-wrap items-center gap-x-1 gap-y-1.5" aria-label="Tocchi dello scambio" data-scout-pending>
        {pending.map((touch, index) => (
          <Fragment key={touch.id}>
            {index > 0 && <Link crossesNet={pending[index - 1].side !== touch.side} />}
            <li>
              <TouchChip touch={touch} roster={roster} />
            </li>
          </Fragment>
        ))}
        {sequence.map((touch, index) => {
          const before = index === 0 ? last?.side : sequence[index - 1].side;
          return (
            <Fragment key={`${touch.skill}-${index}`}>
              {before !== undefined && <Link crossesNet={before !== touch.side} />}
              <li aria-hidden={index > 0}>
                <PhaseChip touch={touch} state={index === 0 ? "now" : "next"} />
              </li>
            </Fragment>
          );
        })}
      </ol>

      {!locked && (
        <div
          className={cn("flex items-start gap-3 rounded-xl border-l-4 px-3 py-2.5", CARD_STYLE[next.side])}
          data-scout-phase-card
          data-scout-phase={next.skill}
          data-scout-phase-side={next.side}
          role="status"
        >
          <span
            aria-hidden
            className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-xl font-extrabold", NOW_STYLE[next.side])}
          >
            {meta.letter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Ora tocca a · <span className={next.side === "us" ? "text-primary" : "text-accent-foreground"}>{next.side === "us" ? "noi" : "loro"}</span>
            </p>
            <p className="font-display text-lg font-extrabold leading-tight text-foreground">
              {meta.label}
              {who && <span className="ml-1.5 text-base font-bold text-muted-foreground">· {who}</span>}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground" data-scout-phase-why>
              {hint.why}
            </p>
          </div>
        </div>
      )}

      <details className="group rounded-xl border border-border-subtle bg-surface-muted/50 px-3 py-2" data-scout-phase-help data-tour="scout-phase-help">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          <span>Come si alternano le fasi</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <p className="mt-2 text-xs font-semibold text-foreground">{PHASE_FLOW}</p>
        <ol className="mt-2 space-y-2 text-[13px] leading-snug text-muted-foreground">
          {PHASE_STEPS.map((step, index) => (
            <li key={step.title}>
              <b className="text-foreground">
                {index + 1} · {step.title}.
              </b>{" "}
              {step.text}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

/** Piccola striscia di passi per i livelli che non segnano ogni tocco: dove si è arrivati nello scambio. */
export function FlowSteps({ steps }: { steps: { label: string; state: "done" | "now" | "todo" }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label="Fasi dello scambio" data-scout-flow-steps>
      {steps.map((step, index) => (
        <Fragment key={step.label}>
          {index > 0 && (
            <li aria-hidden className="text-xs text-muted-foreground/60">
              ›
            </li>
          )}
          <li
            data-scout-flow-step={step.state}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
              step.state === "now" && "border-primary bg-primary text-primary-foreground",
              step.state === "done" && "border-border-subtle bg-surface-muted text-muted-foreground line-through decoration-muted-foreground/40",
              step.state === "todo" && "border-dashed border-border-strong text-muted-foreground",
            )}
          >
            <span className="tabular">{index + 1}</span>
            {step.label}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
