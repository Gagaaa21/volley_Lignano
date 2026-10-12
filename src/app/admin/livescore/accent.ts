import { readableTextColor, teamColor, withAlpha, type TeamKey } from "@/lib/liveScore";
import type { LiveScoreMode, LiveScoreTeamState } from "@/lib/types";

/** Colore distintivo per squadra, riusato ovunque serva riconoscerle a
 * colpo d'occhio: tabellone, storico set, ultimi punti, pulsanti "Punto".
 * Squadra A è sempre il blu del club (fisso). Squadra B è il giallo acceso
 * in allenamento (fisso), oppure il colore scelto dal coach per l'avversaria
 * vera in Partita — per questo entrambe sono espresse come colori concreti
 * (non classi Tailwind), col testo calcolato per restare sempre leggibile. */
export type TeamAccent = { background: string; text: string; textSoft: string; overlay: string; dot: string; glow: string };

export function getTeamAccent(teamKey: TeamKey, mode: LiveScoreMode, opponentColor: string): TeamAccent {
  const hex = teamColor(teamKey, mode, opponentColor);
  const text = readableTextColor(hex);
  const isLightBg = text !== "#ffffff";
  return {
    background: hex,
    text,
    // Varianti più tenui dello stesso testo, per elementi secondari (label
    // "Set", pillola time-out a riposo) — calcolate sul chiaro/scuro dello
    // sfondo invece che fisse, dato che lo sfondo può essere qualunque
    // colore scelto dal coach.
    textSoft: isLightBg ? "rgba(13,25,38,0.65)" : "rgba(255,255,255,0.8)",
    overlay: isLightBg ? "rgba(13,25,38,0.12)" : "rgba(255,255,255,0.22)",
    dot: hex,
    glow: withAlpha(hex, 0.4),
  };
}

/** Etichetta di una squadra da mostrare, con un fallback quando è ancora
 * vuota (es. nome avversaria non ancora scritto in modalità Partita). */
export function displayLabel(team: LiveScoreTeamState, key: TeamKey): string {
  return team.label.trim() || (key === "A" ? "Squadra A" : "Squadra B");
}

