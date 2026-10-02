"use client";

import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import type { BaseTourStep, Rect } from "./types";

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 12;

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
  const style = rect ? placementStyle(rect) : centeredStyle();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tour guidato"
      className="fixed z-[61] w-[min(20rem,calc(100vw-2rem))] animate-[tour-fade-in_200ms_ease-out] rounded-2xl border border-border bg-card p-4 shadow-pop"
      style={style}
    >
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
      <p className="mt-2.5 font-display text-sm font-bold text-foreground">{step.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
      <div className="mt-3.5 flex items-center justify-between gap-2">
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
