"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BaseTourStep, Rect } from "../engine/types";
import { GemCharacter } from "./GemCharacter";
import { clashFont } from "./fonts";

const SPOTLIGHT_PADDING = 8;
const DIM = "rgba(12, 10, 24, 0.62)";
const INK = "#1F1A24";
const SPEAKER = "Gem";

interface ClashTourOverlayProps {
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

/** Variante "videogioco" della scheda del tour, ispirata ai tutorial di
 * Clash of Clans: il personaggio sbuca dal basso a sinistra, parla in un
 * fumetto (testo che compare lettera per lettera, bocca che si muove) e una
 * freccia gialla rimbalza sopra l'elemento evidenziato. Riceve gli stessi
 * valori di useTourEngine di TourOverlay: cambia solo l'aspetto. Montata in
 * un portale su <body>, così nessun antenato con transform o overflow può
 * spostarla o tagliarla. */
export function ClashTourOverlay({
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
}: ClashTourOverlayProps) {
  const [talking, setTalking] = useState(false);
  if (!active || !step || totalSteps === 0) return null;

  const spot = !isCentered && rect ? rect : null;

  return createPortal(
    <div className={cn(clashFont.variable, "fixed inset-0 z-[60]")}>
      {spot ? (
        <>
          <div
            className={cn(
              "pointer-events-none fixed rounded-2xl border-[3px] border-[#FFD23F] motion-safe:animate-[clash-ring_1.5s_ease-out_infinite]",
              !skipTransition && "transition-all duration-300 ease-out",
            )}
            style={{
              top: spot.top - SPOTLIGHT_PADDING,
              left: spot.left - SPOTLIGHT_PADDING,
              width: spot.width + SPOTLIGHT_PADDING * 2,
              height: spot.height + SPOTLIGHT_PADDING * 2,
              boxShadow: `0 0 0 9999px ${DIM}`,
            }}
          />
          <PointerArrow key={step.id} rect={spot} />
        </>
      ) : (
        <div className="fixed inset-0" style={{ background: DIM }} />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 px-2 sm:px-6 lg:px-10">
        <div className="flex w-full max-w-[52rem] items-end">
          <div className="-mb-1 w-[6.75rem] shrink-0 motion-safe:animate-[gem-enter_560ms_cubic-bezier(0.3,1.35,0.6,1)_both] sm:w-[13.5rem] lg:w-[17rem]">
            <div className="origin-bottom motion-safe:animate-[gem-idle_3.6s_ease-in-out_infinite]">
              <GemCharacter talking={talking} className="h-auto w-full drop-shadow-[0_6px_0_rgba(0,0,0,0.25)]" />
            </div>
          </div>
          <SpeechBubble
            key={step.id}
            step={step}
            stepNumber={stepIndex + 1}
            totalSteps={totalSteps}
            canGoBack={stepIndex > 0}
            isLast={stepIndex === totalSteps - 1}
            onBack={goBack}
            onNext={goNext}
            onSkip={skip}
            onTalkingChange={setTalking}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Testo che compare a scatti come nei dialoghi dei videogiochi. Il
 * componente che lo usa viene rimontato a ogni passo (key), quindi il
 * conteggio riparte da zero senza doverlo azzerare a mano. */
function useTypewriter(text: string) {
  const [count, setCount] = useState(() => (prefersReducedMotion() ? text.length : 0));

  useEffect(() => {
    if (count >= text.length) return;
    const timer = setTimeout(() => setCount((c) => Math.min(text.length, c + 2)), 24);
    return () => clearTimeout(timer);
  }, [count, text.length]);

  return {
    shown: text.slice(0, count),
    done: count >= text.length,
    complete: () => setCount(text.length),
  };
}

function SpeechBubble({
  step,
  stepNumber,
  totalSteps,
  canGoBack,
  isLast,
  onBack,
  onNext,
  onSkip,
  onTalkingChange,
}: {
  step: BaseTourStep;
  stepNumber: number;
  totalSteps: number;
  canGoBack: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onTalkingChange: (talking: boolean) => void;
}) {
  const { shown, done, complete } = useTypewriter(step.body);

  useEffect(() => {
    onTalkingChange(!done);
  }, [done, onTalkingChange]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${SPEAKER}: ${step.title}`}
      className="pointer-events-auto relative mb-3 ml-[-0.5rem] min-w-0 flex-1 origin-bottom-left motion-safe:animate-[clash-pop_340ms_cubic-bezier(0.3,1.4,0.6,1)_both] sm:mb-7 sm:ml-[-1rem]"
    >
      <span
        className="clash-outline absolute -top-4 left-4 z-10 -rotate-2 rounded-lg border-[3px] px-4 py-0.5 font-[family-name:var(--font-clash)] text-lg uppercase tracking-wider text-white shadow-[0_3px_0_rgba(31,26,36,0.6)] sm:text-xl"
        style={{ borderColor: INK, background: "linear-gradient(#8A5CC4, #5E3A96)" }}
      >
        {SPEAKER}
      </span>
      <button
        type="button"
        onClick={onSkip}
        aria-label="Chiudi il tour"
        className="absolute -right-1 -top-3.5 z-10 grid h-9 w-9 place-items-center rounded-xl border-[3px] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_3px_0_#1F1A24] transition-transform active:translate-y-[2px]"
        style={{ borderColor: INK, background: "linear-gradient(#FF7A6B, #D9342B)" }}
      >
        <X className="h-5 w-5" strokeWidth={3.5} />
      </button>

      <div
        className="relative rounded-[1.4rem] border-[3px] px-3.5 pb-3 pt-6 shadow-[inset_0_-5px_0_rgba(31,26,36,0.07),0_6px_0_rgba(31,26,36,0.45)] sm:px-5 sm:pb-4"
        style={{ borderColor: INK, background: "#FFF9EC" }}
      >
        <svg
          viewBox="0 0 22 26"
          aria-hidden
          className="absolute -left-[19px] bottom-8 h-[26px] w-[22px] sm:bottom-10"
          fill="#FFF9EC"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        >
          <path d="M22 2 L2 15 L22 24" />
        </svg>

        <p className="font-[family-name:var(--font-clash)] text-[1.1rem] leading-tight text-[#4A2F6E] sm:text-[1.35rem]">
          {step.title}
        </p>
        <p className="sr-only">{step.body}</p>
        <p
          aria-hidden
          className="mt-1.5 min-h-[4.5em] font-[family-name:var(--font-baloo)] text-[14.5px] font-semibold leading-snug text-[#3A2E3F] sm:text-base"
        >
          {shown}
          {!done && (
            <span className="ml-0.5 inline-block h-[1em] w-[3px] translate-y-[2px] animate-pulse rounded-full bg-[#4A2F6E]" />
          )}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-[family-name:var(--font-clash)] text-base text-[#4A2F6E] sm:hidden">
            {stepNumber}/{totalSteps}
          </span>
          <div className="hidden items-center gap-1.5 sm:flex" aria-label={`Passo ${stepNumber} di ${totalSteps}`}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 rounded-full border-2 transition-all",
                  i + 1 === stepNumber ? "w-5 bg-[#FFD23F]" : "w-2.5 bg-[#E4DAC8]",
                )}
                style={{ borderColor: INK }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {canGoBack && (
              <ClashButton tone="blue" onClick={onBack} aria-label="Passo precedente" className="w-10 px-0 sm:w-11 sm:px-0">
                <ChevronLeft className="h-5 w-5" strokeWidth={3.5} />
              </ClashButton>
            )}
            <ClashButton tone="green" onClick={done ? onNext : complete}>
              {isLast ? "Al lavoro!" : "Avanti"}
              {!isLast && <ChevronRight className="-mr-1 h-5 w-5" strokeWidth={3.5} />}
            </ClashButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const BUTTON_TONES: Record<"green" | "blue", CSSProperties> = {
  green: { background: "linear-gradient(#A8E35F, #5DB82C)" },
  blue: { background: "linear-gradient(#80CCFF, #3B8BDB)" },
};

/** Pulsante "in rilievo" da videogioco: bordo scuro, riflesso in alto e
 * base che si schiaccia al tocco. */
function ClashButton({
  tone,
  className,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone: "green" | "blue" }) {
  return (
    <button
      type="button"
      className={cn(
        "clash-outline inline-flex h-10 items-center justify-center gap-0.5 rounded-xl border-[3px] px-3 font-[family-name:var(--font-clash)] text-base uppercase sm:h-11 sm:px-4 sm:text-lg tracking-wide text-white shadow-[inset_0_3px_0_rgba(255,255,255,0.45),inset_0_-4px_0_rgba(0,0,0,0.14),0_4px_0_#1F1A24] transition-[transform,box-shadow] duration-100 active:translate-y-[3px] active:shadow-[inset_0_3px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.14),0_1px_0_#1F1A24]",
        className,
      )}
      style={{ borderColor: INK, ...BUTTON_TONES[tone], ...style }}
      {...props}
    />
  );
}

/** Freccia gialla che rimbalza verso l'elemento evidenziato: sopra di esso,
 * o sotto se è troppo vicino al bordo alto dello schermo. */
function PointerArrow({ rect }: { rect: Rect }) {
  const below = rect.top < 150;
  const x = Math.min(Math.max(rect.left + rect.width / 2, 28), window.innerWidth - 28);
  const style: CSSProperties = below
    ? { top: rect.top + rect.height + SPOTLIGHT_PADDING + 8, left: x }
    : { top: rect.top - SPOTLIGHT_PADDING - 8 - 64, left: x };

  return (
    <div className="pointer-events-none fixed -translate-x-1/2" style={style}>
      <div
        className={
          below
            ? "motion-safe:animate-[clash-arrow-up_0.9s_ease-in-out_infinite]"
            : "motion-safe:animate-[clash-arrow-down_0.9s_ease-in-out_infinite]"
        }
      >
        <svg
          viewBox="0 0 48 64"
          aria-hidden
          className={cn("h-16 w-12 drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]", below && "rotate-180")}
        >
          <path
            d="M16 4 H32 V32 H44 L24 60 L4 32 H16 Z"
            fill="#FFD23F"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M21 9 V34" stroke="#FFF3B0" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
