"use client";

import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Lightbulb, Sparkles, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { isRichStep, type BaseTourStep, type Rect } from "./types";

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 12;
/** La scheda dei passi «ricchi» (guide lunghe): più larga, scorre da sola se il testo non ci sta. */
const RICH_WIDTH = 392;
/** Sotto questa larghezza la scheda ricca diventa un pannello fisso in basso, a tutta larghezza. */
const SHEET_BREAKPOINT = 640;
/** Spazio sopra o sotto l'elemento evidenziato con cui la scheda ricca sta comoda (quasi tutto il testo, senza scorrere). */
const RICH_COMFORT_ROOM = 380;
/** Spazio minimo per metterla lì lo stesso (il testo scorre, i pulsanti restano sempre in vista); sotto, sta in basso sopra l'elemento. */
const RICH_MIN_ROOM = 250;

interface TourOverlayProps {
  active: boolean;
  step: BaseTourStep | undefined;
  stepIndex: number;
  totalSteps: number;
  rect: Rect | null;
  skipTransition: boolean;
  isCentered: boolean;
  goNext: () => void;
  goBack: () => void;
  skip: () => void;
}

/** Spotlight + scheda del tour: identico per tour admin, tour pubblico e
 * mini-tour di sezione, guidato solo dai valori che useTourEngine calcola. */
export function TourOverlay({
  active,
  step,
  stepIndex,
  totalSteps,
  rect,
  skipTransition,
  isCentered,
  goNext,
  goBack,
  skip,
}: TourOverlayProps) {
  if (!active || !step || totalSteps === 0) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {isCentered && <div className="fixed inset-0 bg-[rgba(12,29,54,0.45)] backdrop-blur-[2px]" />}
      {!isCentered && rect && (
        <div
          className={cn(
            "pointer-events-none fixed rounded-2xl shadow-[0_0_0_9999px_rgba(9,27,38,0.55)]",
            !skipTransition && "transition-all duration-300 ease-out",
          )}
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      )}

      <TourCard
        step={step}
        stepNumber={stepIndex + 1}
        totalSteps={totalSteps}
        rect={isCentered ? null : rect}
        canGoBack={stepIndex > 0}
        isLast={stepIndex === totalSteps - 1}
        onBack={goBack}
        onNext={goNext}
        onSkip={skip}
      />
    </div>
  );
}

function TourCard({
  step,
  stepNumber,
  totalSteps,
  rect,
  canGoBack,
  isLast,
  onBack,
  onNext,
  onSkip,
}: {
  step: BaseTourStep;
  stepNumber: number;
  totalSteps: number;
  rect: Rect | null;
  canGoBack: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const rich = isRichStep(step);
  const sheet = rich && window.innerWidth < SHEET_BREAKPOINT;
  const style = rich ? richStyle(rect, sheet) : rect ? placementStyle(rect) : centeredStyle();
  const paragraphs = step.body.split(/\n{2,}/);

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="icon-chip shrink-0">
          <Sparkles className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Chiudi il tour"
          className="shrink-0 rounded-full p-1 text-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {step.chapter && (
        <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary" data-tour-chapter>
          {step.chapter}
        </p>
      )}
      <p className={cn("font-display text-sm font-bold text-foreground", step.chapter ? "mt-0.5" : "mt-2.5")}>{step.title}</p>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="mt-1 text-sm text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {step.example && (
        <p className="mt-2.5 rounded-xl bg-primary-soft px-3 py-2 text-[13px] leading-snug text-foreground" data-tour-example>
          <b className="font-bold text-primary">Esempio · </b>
          {step.example}
        </p>
      )}
      {step.tip && (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2 text-[13px] leading-snug text-foreground" data-tour-tip>
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          <span>{step.tip}</span>
        </p>
      )}
      {step.warning && (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-[13px] leading-snug text-foreground" data-tour-warning>
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>{step.warning}</span>
        </p>
      )}
    </>
  );

  const footer = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-xs font-medium text-muted-foreground">
          {stepNumber} di {totalSteps}
        </span>
        <div className="flex items-center gap-1.5">
          {canGoBack && (
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Indietro
            </Button>
          )}
          <Button type="button" size="sm" onClick={onNext}>
            {isLast ? "Fine" : "Avanti"}
            {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="mt-2.5 w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Salta il tour
      </button>
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tour guidato"
      data-tour-card={rich ? "rich" : "simple"}
      data-tour-step={step.id}
      className={cn(
        "fixed z-[61] animate-[tour-fade-in_200ms_ease-out] border border-border bg-card shadow-pop",
        !rich && "w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-4",
        rich && "flex flex-col overflow-hidden",
        rich && !sheet && "w-[min(24.5rem,calc(100vw-2rem))] rounded-2xl",
        sheet && "inset-x-2 bottom-2 rounded-2xl",
      )}
      style={style}
    >
      {rich ? (
        <>
          <div className="h-1 shrink-0 overflow-hidden bg-muted" aria-hidden>
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(stepNumber / totalSteps) * 100}%` }} />
          </div>
          {/* Il testo scorre se è lungo; i pulsanti restano sempre in vista, qualunque sia lo spazio. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-1 pt-3" data-tour-body>
            {body}
          </div>
          <div className="shrink-0 border-t border-border-subtle px-4 pb-3 pt-3">{footer}</div>
        </>
      ) : (
        <>
          {body}
          <div className="mt-3.5">{footer}</div>
        </>
      )}
    </div>
  );
}

function centeredStyle(): CSSProperties {
  return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
}

function placementStyle(rect: Rect): CSSProperties {
  const estimatedHeight = 200;
  let top = rect.top + rect.height + TOOLTIP_MARGIN;
  if (top + estimatedHeight > window.innerHeight - TOOLTIP_MARGIN) {
    top = Math.max(TOOLTIP_MARGIN, rect.top - estimatedHeight - TOOLTIP_MARGIN);
  }
  const left = Math.min(Math.max(rect.left, TOOLTIP_MARGIN), window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
  return { top, left };
}

/**
 * Posizione della scheda ricca: sotto l'elemento evidenziato se c'è posto,
 * altrimenti sopra; se né sopra né sotto ce n'è abbastanza (l'elemento è alto
 * quasi come lo schermo) la scheda sta in basso, davanti a lui. Su telefono è
 * un pannello fisso in basso (le classi fanno il resto). L'altezza massima fa
 * scorrere il testo lungo: i pulsanti restano sempre in vista.
 */
function richStyle(rect: Rect | null, sheet: boolean): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const maxAvailable = vh - 2 * TOOLTIP_MARGIN;
  if (sheet) return { maxHeight: Math.round(vh * 0.56) };
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxHeight: maxAvailable };
  const left = Math.min(Math.max(rect.left, TOOLTIP_MARGIN), Math.max(TOOLTIP_MARGIN, vw - RICH_WIDTH - TOOLTIP_MARGIN));
  const gap = TOOLTIP_MARGIN + SPOTLIGHT_PADDING;
  const below = vh - (rect.top + rect.height) - gap - TOOLTIP_MARGIN;
  const above = rect.top - gap - TOOLTIP_MARGIN;
  const placeBelow = (): CSSProperties => ({ top: rect.top + rect.height + gap, left, maxHeight: Math.min(below, maxAvailable) });
  const placeAbove = (): CSSProperties => ({ bottom: vh - rect.top + gap, left, maxHeight: Math.min(above, maxAvailable) });
  if (below >= RICH_COMFORT_ROOM) return placeBelow();
  if (above >= RICH_COMFORT_ROOM) return placeAbove();
  // Nessuna delle due sta comoda: la migliore, se almeno ci sta il minimo; altrimenti in basso, davanti all'elemento.
  if (below >= RICH_MIN_ROOM && below >= above) return placeBelow();
  if (above >= RICH_MIN_ROOM) return placeAbove();
  return { bottom: TOOLTIP_MARGIN, left, maxHeight: Math.round(vh * 0.62) };
}
