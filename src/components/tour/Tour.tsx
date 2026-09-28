"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import type { SessionPayload } from "@/lib/auth/session";
import type { AdminPage, TrainingTeam } from "@/lib/types";
import { finishTourAction } from "./actions";
import { getVisibleSteps, type TourStep } from "./steps";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 12;
const LOCATE_TIMEOUT_MS = 4000;
const POLL_INTERVAL_MS = 80;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function closeMobileMenuIfOpen() {
  const toggle = document.querySelector<HTMLElement>('[data-tour="mobile-menu-toggle"]');
  if (toggle && toggle.getAttribute("aria-expanded") === "true") toggle.click();
}

/**
 * Cerca l'elemento reale da evidenziare per questo passo. Le voci di nav
 * normali esistono una sola volta nel DOM (il contenitore attorno cambia
 * solo visibilità mobile/desktop), ma il menu Developer e — su schermi
 * stretti — il menu ad hamburger nascondono i propri link finché non
 * vengono aperti: si prova prima direttamente, poi si aprono da soli
 * (leggendo lo stato reale da aria-expanded, niente configurazione per
 * passo) e si riprova, fino a un timeout oltre il quale il passo — es. uno
 * riservato al Developer mostrato per errore, o "Modalità prova" assente
 * perché già attiva — viene semplicemente saltato.
 */
async function locateTarget(id: string): Promise<HTMLElement | null> {
  const deadline = Date.now() + LOCATE_TIMEOUT_MS;
  let triedMobile = false;
  let triedDev = false;

  while (Date.now() < deadline) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
    const visible = candidates.find(isVisible);
    if (visible) return visible;

    const mobileToggle = document.querySelector<HTMLElement>('[data-tour="mobile-menu-toggle"]');
    if (
      mobileToggle &&
      isVisible(mobileToggle) &&
      mobileToggle.getAttribute("aria-expanded") !== "true" &&
      !triedMobile
    ) {
      triedMobile = true;
      mobileToggle.click();
      await nextFrame();
      continue;
    }

    const devToggle = document.querySelector<HTMLElement>('[data-tour="dev-menu-toggle"]');
    if (devToggle && isVisible(devToggle) && devToggle.getAttribute("aria-expanded") !== "true" && !triedDev) {
      triedDev = true;
      devToggle.click();
      await nextFrame();
      continue;
    }

    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

export function Tour({
  session,
  allowedPages,
  allowedTeams,
  activeTeam,
}: {
  session: SessionPayload;
  allowedPages: AdminPage[];
  allowedTeams: TrainingTeam[];
  activeTeam: TrainingTeam;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [steps] = useState<TourStep[]>(() =>
    getVisibleSteps(session.role, allowedPages, allowedTeams, activeTeam),
  );
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [skipTransition, setSkipTransition] = useState(true);

  const step = steps[stepIndex];

  function finish() {
    setActive(false);
    void finishTourAction();
  }

  function goNext() {
    closeMobileMenuIfOpen();
    if (stepIndex + 1 >= steps.length) finish();
    else setStepIndex(stepIndex + 1);
  }

  function goBack() {
    closeMobileMenuIfOpen();
    setStepIndex(Math.max(0, stepIndex - 1));
  }

  // Avvio automatico al primo accesso. Il layout che monta <Tour> non si
  // rimonta mai navigando tra le pagine /admin/* (nemmeno dopo il redirect
  // che segue il cambio password forzato: è la stessa istanza del
  // componente, solo con nuove props) — quindi un useState pigro
  // calcolato una volta sola al primo mount resterebbe bloccato al valore
  // letto mentre si era ancora su /admin/cambia-password (mustChangePassword
  // true). Questo effect osserva invece session.mustChangePassword/
  // hasSeenGuide a ogni render successivo e decide una sola volta (via
  // ref, non stato) non appena il cambio password forzato è concluso.
  const autoStartDecided = useRef(false);
  useEffect(() => {
    if (autoStartDecided.current || session.mustChangePassword) return;
    autoStartDecided.current = true;
    // Sincronizza lo stato del tour con la sessione server (props), un
    // sistema esterno a questo componente — non uno stato derivabile a
    // render, dato che deve accadere una sola volta per l'intera durata
    // del tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!session.hasSeenGuide) setActive(true);
  }, [session.mustChangePassword, session.hasSeenGuide]);

  // "Rivedi il tour guidato" (pulsante in /admin/guida): riparte anche se
  // hasSeenGuide è già true. Il link punta sempre a una pagina diversa da
  // /admin/guida (il passo "welcome"), quindi il cambio di pathname fa
  // rieseguire questo effetto in modo affidabile senza bisogno di
  // useSearchParams (e del relativo obbligo di un boundary Suspense).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("tour") !== "restart") return;
    // Sincronizza lo stato del tour con un segnale esterno (la query
    // string): un caso d'uso da effect esplicitamente valido, la regola
    // del linter non distingue questo da uno stato derivabile a render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex(0);
    setActive(true);
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Naviga verso la pagina del passo corrente, se non ci siamo già.
  useEffect(() => {
    if (!active || !step) return;
    if (pathname !== step.path) router.push(step.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, pathname]);

  // Individua e misura l'elemento del passo corrente, una volta sulla
  // pagina giusta.
  useEffect(() => {
    if (!active || !step) return;
    if (pathname !== step.path) return;

    // Niente da cercare per un passo centrato (benvenuto/fine): isCentered
    // in fase di render tratta questo caso indipendentemente da `rect`.
    if (!step.target) return;

    let cancelled = false;
    // Disattiva la transizione CSS della spotlight per il primo
    // posizionamento di questo passo (si riattiva da sola un frame dopo la
    // misurazione, più sotto): sincronizza il rendering con il timing di
    // paint del browser, un altro caso legittimo di effect-esterno che
    // questa regola del linter non distingue da stato derivabile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkipTransition(true);
    locateTarget(step.target).then((el) => {
      if (cancelled) return;
      if (!el) {
        console.warn("[tour] elemento non trovato, passo saltato:", step.id);
        goNext();
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "auto" });
      setRect(measure(el));
      requestAnimationFrame(() => setSkipTransition(false));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, pathname]);

  // Tiene la spotlight allineata mentre resta visibile (scroll/resize),
  // senza dover ricercare l'elemento da capo.
  useEffect(() => {
    if (!active || !step?.target) return;
    const targetId = step.target;
    let frame = 0;
    function onScrollOrResize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-tour="${targetId}"]`);
        if (el && isVisible(el)) setRect(measure(el));
      });
    }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [active, step]);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  if (!active || !step || steps.length === 0) return null;

  const isCentered = !step.target || !rect;

  return (
    <div className="fixed inset-0 z-[60]">
      {isCentered && <div className="fixed inset-0 bg-sea-950/55" />}
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
        totalSteps={steps.length}
        rect={isCentered ? null : rect}
        canGoBack={stepIndex > 0}
        isLast={stepIndex === steps.length - 1}
        onBack={goBack}
        onNext={goNext}
        onSkip={finish}
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
  step: TourStep;
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
      className="fixed z-[61] w-[min(20rem,calc(100vw-2rem))] animate-[tour-fade-in_200ms_ease-out] rounded-2xl border border-border-subtle bg-surface p-4 shadow-[0_20px_50px_-20px_rgba(9,27,38,0.45)]"
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
        <span className="text-xs font-medium text-foreground/40">
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
        className="mt-2.5 w-full text-center text-xs font-medium text-foreground/45 transition-colors hover:text-foreground/70"
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
