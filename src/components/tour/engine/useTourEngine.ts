"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isVisible, locateTarget, measure } from "./helpers";
import { isRichStep, type BaseTourStep, type Rect } from "./types";

/** Aria lasciata sopra l'elemento evidenziato quando lo si porta in cima allo schermo per una scheda ricca. */
const RICH_TOP_GAP = 16;

/** Il menu fisso in cima all'area riservata: coprirebbe l'elemento portato in alto, quindi ci si ferma sotto di lui. */
function stickyHeaderBottom(): number {
  const header = document.querySelector<HTMLElement>("header.page-header");
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
}

interface UseTourEngineOptions {
  /** Chiamato quando il tour finisce (ultimo "Avanti", "Fine", "Salta il
   * tour", X, o Escape) — es. per segnare il tour visto o salvarlo in
   * localStorage. Non chiamato per una semplice chiusura di passo.
   * `completed` è vero solo se si è arrivati in fondo (non se è stato saltato). */
  onFinish?: (completed: boolean) => void;
  /** Chiamato prima di cambiare passo (Avanti/Indietro) — usato dal tour
   * admin per richiudere il menu mobile aperto da locateTarget, irrilevante
   * (e innocuo) per i sapori senza quel menu. */
  onBeforeStepChange?: () => void;
}

/** Stato ed effect generici condivisi da tour admin, tour pubblico e
 * mini-tour di sezione: individuare/misurare l'elemento del passo corrente,
 * navigare verso la sua pagina se serve, tenere la spotlight allineata su
 * scroll/resize, chiudere con Escape. Ogni sapore fornisce solo i propri
 * `steps` e le callback che gli servono. */
export function useTourEngine<T extends BaseTourStep>(steps: T[], options?: UseTourEngineOptions) {
  const pathname = usePathname();
  const router = useRouter();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [skipTransition, setSkipTransition] = useState(true);

  const step = steps[stepIndex];

  function start() {
    setStepIndex(0);
    setActive(true);
  }

  function finish(completed = false) {
    setActive(false);
    options?.onFinish?.(completed);
  }

  function goNext() {
    options?.onBeforeStepChange?.();
    if (stepIndex + 1 >= steps.length) finish(true);
    else setStepIndex(stepIndex + 1);
  }

  function goBack() {
    options?.onBeforeStepChange?.();
    setStepIndex(Math.max(0, stepIndex - 1));
  }

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
    // paint del browser, un caso legittimo di effect-esterno che questa
    // regola del linter non distingue da stato derivabile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkipTransition(true);
    locateTarget(step.target).then((el) => {
      if (cancelled) return;
      if (!el) {
        console.warn("[tour] elemento non trovato, passo saltato:", step.id);
        goNext();
        return;
      }
      // Le guide lunghe hanno una scheda alta: l'elemento va portato in cima allo schermo, così sotto di lui
      // (o, su telefono, sopra il pannello in basso) resta il posto per la scheda.
      const rich = isRichStep(step);
      // «instant»: il sito ha lo scorrimento dolce (scroll-smooth), che farebbe misurare l'elemento prima che arrivi.
      el.scrollIntoView({ block: rich ? "start" : "center", behavior: "instant" });
      if (rich) window.scrollBy({ top: -(stickyHeaderBottom() + RICH_TOP_GAP), behavior: "instant" });
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
      if (e.key === "Escape") finish(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const isCentered = !step?.target || !rect;

  return {
    active,
    step,
    stepIndex,
    totalSteps: steps.length,
    rect,
    skipTransition,
    isCentered,
    start,
    goNext,
    goBack,
    skip: () => finish(false),
  };
}
