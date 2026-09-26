import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CourtPosition } from "@/lib/types";

/**
 * Le due squadre giocano su lati opposti della rete e si guardano l'una
 * con l'altra: la stessa posizione (es. 2, avanti a destra) cade quindi
 * specchiata rispetto all'asse verticale a seconda di quale squadra la
 * occupa — non un semplice ribaltamento colonna per colonna, ma due
 * ordini davvero distinti. Verificato posizione per posizione su
 * entrambi gli schemi di rotazione reali allegati (uno per squadra):
 * fila vicino alla rete e fila sul fondo campo, dall'alto in basso.
 */
const LEFT_NET_COL: CourtPosition[] = [4, 3, 2];
const LEFT_BASELINE_COL: CourtPosition[] = [5, 6, 1];
const RIGHT_NET_COL: CourtPosition[] = [2, 3, 4];
const RIGHT_BASELINE_COL: CourtPosition[] = [1, 6, 5];

/** Le sei posizioni di una metà campo, in ordine di lettura riga per riga
 * di una griglia 2 colonne × 3 righe: colonna vicina al centro (rete) e
 * colonna verso il bordo esterno (fondo campo). */
function halfCourtOrder(side: "left" | "right"): CourtPosition[] {
  const netCol = side === "left" ? LEFT_NET_COL : RIGHT_NET_COL;
  const baselineCol = side === "left" ? LEFT_BASELINE_COL : RIGHT_BASELINE_COL;
  const order: CourtPosition[] = [];
  for (let row = 0; row < 3; row++) {
    if (side === "left") order.push(baselineCol[row], netCol[row]);
    else order.push(netCol[row], baselineCol[row]);
  }
  return order;
}

function HalfCourt({
  side,
  renderCell,
  large,
}: {
  side: "left" | "right";
  renderCell: (position: CourtPosition) => ReactNode;
  large: boolean;
}) {
  const order = halfCourtOrder(side);
  return (
    <div
      className={cn(
        "grid flex-1 grid-rows-3 gap-px bg-white/80",
        // Ogni metà campo è un quadrato di 9x9m: la fila vicino alla rete
        // occupa i primi 3m (linea d'attacco), il fondo campo i restanti
        // 6m — colonne in proporzione 1:2, non a metà, per restare fedeli
        // alle misure reali di un campo di pallavolo.
        side === "left" ? "grid-cols-[2fr_1fr]" : "grid-cols-[1fr_2fr]",
        large && "h-full",
      )}
    >
      {order.map((position, idx) => (
        <div
          key={position}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-sand-200 to-sand-400 px-2 text-center transition-[min-height] duration-200",
            idx % 2 === 0 ? "from-sand-300 to-sand-400" : "from-sand-200 to-sand-300",
            large ? "py-2 sm:py-3" : "min-h-20 py-4 sm:min-h-24 sm:py-5",
            idx % 2 === 0 && "border-r-[3px] border-white/95",
          )}
        >
          <span
            className={cn(
              "absolute flex items-center justify-center rounded-full bg-sea-950/10 font-bold text-sea-950/55 ring-1 ring-inset ring-sea-950/10",
              large ? "left-2 top-2 h-6 w-6 text-[11px] sm:h-7 sm:w-7 sm:text-xs" : "left-1.5 top-1.5 h-4 w-4 text-[9px]",
            )}
          >
            {position}
          </span>
          {renderCell(position)}
        </div>
      ))}
    </div>
  );
}

/** Etichetta "Fondo campo" in verticale, alla fine del campo (bordo
 * esterno sinistro o destro) invece che come didascalia orizzontale sotto
 * — come un'etichetta di quota su una pianta. */
function EndLabel({ text, large }: { text: string; large: boolean }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center", large ? "w-8 sm:w-10" : "w-6 sm:w-7")}>
      <span
        className={cn(
          "origin-center -rotate-90 whitespace-nowrap font-bold uppercase tracking-[0.18em] text-sea-100/60",
          large ? "text-xs sm:text-sm" : "text-[10px] sm:text-[11px]",
        )}
      >
        {text}
      </span>
    </div>
  );
}

/** Rete: nastro bianco sopra e sotto la maglia (trama a rombi incrociata),
 * con due "pali" pieni alle estremità, come sui campi veri — puramente
 * decorativa e sovrapposta, non fa parte del layout a griglia. */
function Net({ large }: { large: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.15)]",
        large ? "inset-y-3 w-2.5 sm:inset-y-4 sm:w-3" : "inset-y-2 w-1.5 sm:inset-y-3 sm:w-2",
      )}
    >
      <div
        className="absolute inset-0 bg-sea-950/90"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 2px, rgba(255,255,255,0.35) 2px 3px), repeating-linear-gradient(-45deg, transparent 0 2px, rgba(255,255,255,0.35) 2px 3px)",
        }}
      />
      <div className={cn("absolute inset-x-0 top-0 bg-white", large ? "h-2.5 sm:h-3" : "h-1.5 sm:h-2")} />
      <div className={cn("absolute inset-x-0 bottom-0 bg-white", large ? "h-2.5 sm:h-3" : "h-1.5 sm:h-2")} />
    </div>
  );
}

/** Campo intero e continuo in orizzontale, come un vero campo visto
 * dall'alto: una sola rete sottile al centro (non un divisorio largo), il
 * fondo campo di ciascuna squadra sul bordo esterno, etichettato in
 * verticale alla fine del campo. Le due metà restano indipendenti nei dati
 * (renderCellA/renderCellB), ma i due grid stanno incollati fianco a
 * fianco (senza spazio tra loro) così da sembrare un unico rettangolo —
 * la rete è solo una linea sottile disegnata sopra, non un terzo elemento
 * che occupa spazio nel layout. `large` (schermo intero) ingrandisce
 * celle, etichette e rete per restare leggibile da bordo campo. */
export function DualLiveScoreCourt({
  renderCellA,
  renderCellB,
  large = false,
}: {
  renderCellA: (position: CourtPosition) => ReactNode;
  renderCellB: (position: CourtPosition) => ReactNode;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-sea-700/50 bg-gradient-to-b from-sea-700 to-sea-950 shadow-xl shadow-sea-950/30",
        large ? "flex min-h-0 flex-1 flex-col items-center justify-center p-4 sm:p-6" : "p-3 sm:p-4",
      )}
    >
      {/* Luce ambientale dall'alto, per dare profondità al pannello invece di un blu piatto. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />

      {/* Un campo vero è 18x9m: rapporto 2:1, mai deformato per riempire lo
       * spazio. Si adatta alla larghezza disponibile e, a schermo intero,
       * anche all'altezza rimasta (max-h-full) restando sempre in scala. */}
      <div className="relative mx-auto flex aspect-[2/1] w-full max-h-full items-stretch">
        <EndLabel text="Fondo campo" large={large} />

        <div className="relative flex flex-1 overflow-hidden rounded-lg border-2 border-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.25)]">
          <HalfCourt side="left" renderCell={renderCellA} large={large} />
          <HalfCourt side="right" renderCell={renderCellB} large={large} />

          <Net large={large} />
        </div>

        <EndLabel text="Fondo campo" large={large} />
      </div>
    </div>
  );
}
