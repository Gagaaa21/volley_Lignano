"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { GemHead } from "./GemCharacter";

type Edge = "left" | "right" | "bottom";
type Phase = "hidden" | "peek" | "caught";

interface Spot {
  edge: Edge;
  /** Posizione lungo il bordo, in percentuale dello schermo. */
  pos: number;
  tilt: number;
}

const APPEAR_CHANCE = 0.3;
const MIN_GAP_MS = 90_000;
const PEEK_MS = 7000;
const CAUGHT_MS = 4800;
const LEAVE_MS = 450;
const LAST_PEEK_KEY = "vl-gem-last-peek";
const FOUND_KEY = "vl-gem-found";

const LINES = [
  "Mi hai beccato! Venti squat jump di punizione.",
  "Shh… sto controllando chi salta il riscaldamento.",
  "Non sono qui. Stai lavorando troppo, Capo.",
  "Hai visto la mia scure? L'avevo appoggiata in palestra…",
  "Il fischietto l'ho nascosto io. Non dirlo a nessuno.",
  "Ancora tu? Ti tengo d'occhio.",
  "Gem vede tutto. Anche le schede non collegate.",
  "Il mio parrucchiere? Segreto professionale.",
  "Facevo solo un giro di ricognizione.",
  "Più veloce di un tempo di volo, eh?",
];

// Battute legate alla sezione aperta: la prima che combacia vince, quindi
// la dashboard ("/admin" esatto) è gestita a parte in pageLine().
const PAGE_LINES: [prefix: string, line: string][] = [
  ["/admin/test-fisici", "Ehi, questa è casa mia!"],
  ["/admin/presenze", "Sto contando chi manca. Tu ci sei, bravo."],
  ["/admin/partite", "Vinciamo, vero? Altrimenti affilo la scure."],
  ["/admin/allenamenti", "Allenamento? Io porto la scure, tu i palloni."],
  ["/admin/schede", "Una scheda senza burpees non è una scheda."],
  ["/admin/livescore", "Il punteggio lo tengo io. A colpi di scure."],
  ["/admin/pronostici", "Il mio pronostico? Tre a zero. Per Gem."],
  ["/admin/staff", "Nuovo allenatore? Lo metto subito alla prova."],
];

const MILESTONES: Record<number, string> = {
  1: "Mi hai trovato! Da oggi ci teniamo d'occhio a vicenda.",
  5: "Già 5 volte? Hai l'occhio del boia.",
  10: "10 volte! Ok, il vero boia sei tu.",
  25: "25?! Non hai niente di meglio da fare? (Neanch'io.)",
  50: "50. Ufficialmente il mio miglior amico.",
};

const SUMMON_LINE = "Mi hai chiamato, Capo?";

function pageLine(pathname: string) {
  if (pathname === "/admin") return "Bella dashboard. L'ho spolverata io.";
  return PAGE_LINES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? null;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomSpot(): Spot {
  const roll = Math.random();
  if (roll < 0.4) {
    const pos = randomBetween(12, 78);
    // Un banner fisso in basso (es. "Installa l'app") coprirebbe Gem e lo
    // renderebbe intoccabile: in quel caso sbuca da un lato.
    if (!isCoveredByFixed((window.innerWidth * pos) / 100 + 40, window.innerHeight - 16)) {
      return { edge: "bottom", pos, tilt: randomBetween(-10, 10) };
    }
  }
  return { edge: roll < 0.7 ? "left" : "right", pos: randomBetween(30, 68), tilt: 0 };
}

function isCoveredByFixed(x: number, y: number) {
  for (let el = document.elementFromPoint(x, y); el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).position === "fixed") return true;
  }
  return false;
}

/** Durante i test automatici (Playwright imposta navigator.webdriver) Gem
 * resta nascosto: una testa che sbuca a caso potrebbe coprire un pulsante
 * proprio mentre un test prova a cliccarlo. */
function isAutomated() {
  return typeof navigator !== "undefined" && navigator.webdriver;
}

function readNumber(storage: Storage, key: string) {
  try {
    return Number(storage.getItem(key) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writeNumber(storage: Storage, key: string, value: number) {
  try {
    storage.setItem(key, String(value));
  } catch {
    // storage non disponibile (modalità privata, ecc.): pazienza, Gem
    // perde solo la memoria dei ritrovamenti.
  }
}

/** Easter egg dell'area tecnici: ogni tanto, cambiando pagina, Gem sbuca
 * da un bordo dello schermo (mai più di una volta ogni minuto e mezzo per
 * scheda del browser) e dopo qualche secondo si rinasconde. Chi lo tocca
 * in tempo lo "trova": salta fuori con una battuta — a volte legata alla
 * sezione aperta — e il conteggio dei ritrovamenti resta sul dispositivo.
 * Scrivere "gem" sulla tastiera, fuori dai campi di testo, lo chiama. Sta
 * sotto finestre di dialogo e tour (z-40) e non parte mai mentre uno è
 * aperto. */
export function GemPeek() {
  const pathname = usePathname();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [phase, setPhase] = useState<Phase>("hidden");
  const [shown, setShown] = useState(false);
  const [line, setLine] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const lastLine = useRef("");

  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function appear(next: Spot, nextPhase: Phase) {
    clearTimers();
    setSpot(next);
    setPhase(nextPhase);
    setShown(false);
    // Due frame: il primo monta Gem fuori schermo, il secondo avvia la
    // transizione verso la posizione visibile.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    later(leave, nextPhase === "peek" ? PEEK_MS : CAUGHT_MS);
  }

  function leave() {
    clearTimers();
    setShown(false);
    later(() => {
      setPhase("hidden");
      setSpot(null);
    }, LEAVE_MS);
  }

  function pickLine(count: number) {
    const fromPage = pageLine(pathname);
    let next = MILESTONES[count] ?? (fromPage && Math.random() < 0.5 ? fromPage : null);
    while (!next || next === lastLine.current) {
      next = LINES[Math.floor(Math.random() * LINES.length)];
    }
    lastLine.current = next;
    return next;
  }

  function onHeadClick() {
    if (phase === "caught") {
      leave();
      return;
    }
    const count = readNumber(localStorage, FOUND_KEY) + 1;
    writeNumber(localStorage, FOUND_KEY, count);
    clearTimers();
    setFound(count);
    setLine(pickLine(count));
    setPhase("caught");
    // Preso al volo mentre si stava già ritirando: torna fuori.
    setShown(true);
    later(leave, CAUGHT_MS);
  }

  const maybePeek = useEffectEvent(() => {
    if (phase !== "hidden") return;
    if (document.visibilityState !== "visible" || document.querySelector('[aria-modal="true"]')) return;
    writeNumber(sessionStorage, LAST_PEEK_KEY, Date.now());
    setFound(null);
    appear(randomSpot(), "peek");
  });

  const summon = useEffectEvent(() => {
    setFound(null);
    setLine(SUMMON_LINE);
    appear({ edge: "bottom", pos: randomBetween(15, 72), tilt: 0 }, "caught");
  });

  // A ogni cambio di pagina, una possibilità su tre che Gem si affacci
  // dopo qualche secondo.
  useEffect(() => {
    if (isAutomated() || Math.random() > APPEAR_CHANCE) return;
    if (Date.now() - readNumber(sessionStorage, LAST_PEEK_KEY) < MIN_GAP_MS) return;
    const timer = window.setTimeout(maybePeek, randomBetween(4000, 13000));
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (isAutomated()) return;
    let typed = "";
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      typed = (typed + e.key.toLowerCase()).slice(-3);
      if (typed === "gem") {
        typed = "";
        summon();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  if (phase === "hidden" || !spot) return null;

  const caught = phase === "caught";

  return (
    <div className="pointer-events-none fixed z-40 w-[4.5rem] sm:w-[5.5rem]" style={anchorStyle(spot)}>
      <button
        type="button"
        onClick={onHeadClick}
        aria-label={caught ? "Rimanda via Gem" : "Gem ti sta spiando: toccalo!"}
        className="pointer-events-auto block w-full cursor-pointer transition-transform duration-[450ms] ease-[cubic-bezier(0.3,1.4,0.6,1)] motion-reduce:transition-none"
        style={{ transform: headTransform(spot, shown ? phase : "hidden"), transformOrigin: ORIGIN[spot.edge] }}
      >
        <GemHead
          talking={caught && shown}
          className={cn(
            "h-auto w-full drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]",
            !caught && "motion-safe:animate-[gem-peek-wiggle_1.6s_ease-in-out_infinite]",
          )}
        />
      </button>

      {caught && shown && (
        <div
          role="status"
          className="absolute w-max max-w-[min(15rem,calc(100vw-7rem))] animate-[gem-bubble-pop_280ms_cubic-bezier(0.3,1.4,0.6,1)_both] rounded-2xl border-[3px] border-[#1F1A24] bg-[#FFF9EC] px-3.5 py-2.5 shadow-[0_4px_0_rgba(31,26,36,0.45)]"
          style={bubblePosition(spot)}
        >
          <p className="font-[family-name:var(--font-baloo)] text-[15px] font-bold leading-snug text-[#3A2E3F]">
            <span className="mr-1 text-[#6B3FA0]">Gem:</span>
            {line}
          </p>
          {found !== null && (
            <p className="mt-1 font-[family-name:var(--font-baloo)] text-xs font-semibold text-[#8A7F86]">
              Trovato {found} {found === 1 ? "volta" : "volte"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const ORIGIN: Record<Edge, string> = { bottom: "50% 100%", left: "0% 50%", right: "100% 50%" };

function anchorStyle(spot: Spot): CSSProperties {
  if (spot.edge === "bottom") return { bottom: 0, left: `${spot.pos}%` };
  if (spot.edge === "left") return { left: 0, top: `${spot.pos}%` };
  return { right: 0, top: `${spot.pos}%` };
}

/** Fuori schermo, affacciato (solo capelli e occhi) o saltato fuori. */
function headTransform(spot: Spot, phase: Phase) {
  switch (spot.edge) {
    case "bottom":
      if (phase === "caught") return "translateY(6%)";
      if (phase === "peek") return `translateY(47%) rotate(${spot.tilt}deg)`;
      return "translateY(110%)";
    case "left":
      if (phase === "caught") return "translateX(10%) rotate(6deg)";
      if (phase === "peek") return "translateX(-48%) rotate(28deg)";
      return "translateX(-115%) rotate(28deg)";
    case "right":
      if (phase === "caught") return "translateX(-10%) rotate(-6deg)";
      if (phase === "peek") return "translateX(48%) rotate(-28deg)";
      return "translateX(115%) rotate(-28deg)";
  }
}

/** Il fumetto si apre sempre verso il centro dello schermo. */
function bubblePosition(spot: Spot): CSSProperties {
  if (spot.edge === "left") return { top: "-0.5rem", left: "calc(100% + 0.75rem)" };
  if (spot.edge === "right") return { top: "-0.5rem", right: "calc(100% + 0.75rem)" };
  return spot.pos < 50
    ? { bottom: "calc(100% + 0.25rem)", left: "-0.5rem" }
    : { bottom: "calc(100% + 0.25rem)", right: "-0.5rem" };
}
