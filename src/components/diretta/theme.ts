/**
 * I colori del pacchetto grafico della diretta video: allegri, come Lignano Sabbiadoro d'estate. L'azzurro del mare (il blu
 * dello stemma) per i riquadri, il giallo del sole (le lettere dello stemma) per gli accenti, e un tramonto giallo → arancio →
 * rosa per etichette e strisce; verde e rosso vivi per chi entra e chi esce nei cambi. Le misure stanno nei componenti, in rem.
 */
export const INK = "#0b1b4d";
export const ROYAL = "#1d4ed8";
export const AZURE = "#2f80ed";
export const SKY = "#22b8f0";
export const SUN = "#ffd23f";
export const ORANGE = "#ff8a3d";
export const PINK = "#ff4f8b";
export const VIOLET = "#8b5cf6";
export const IN_GREEN = "#2ee07a";
export const OUT_RED = "#ff4d5e";

/** I riquadri: un azzurro che va dal blu reale al celeste. */
export const PANEL_BG = `linear-gradient(120deg, ${ROYAL} 0%, ${AZURE} 55%, ${SKY} 100%)`;
/** Etichette e strisce: il tramonto. */
export const SUNSET = `linear-gradient(90deg, ${SUN} 0%, ${ORANGE} 55%, ${PINK} 100%)`;
/** Righe sportive appena accennate sui riquadri. */
export const STRIPES = "repeating-linear-gradient(115deg, rgba(255,255,255,0.07) 0 0.55rem, rgba(255,255,255,0) 0.55rem 1.4rem)";
export const SHADOW = "0 0.6rem 1.8rem rgba(8, 20, 70, 0.45)";
/** I colori dei coriandoli. */
export const PARTY = [SUN, ORANGE, PINK, SKY, IN_GREEN, "#ffffff", VIOLET];
