/**
 * I colori del pacchetto grafico della diretta video: blu notte come base, il blu del club, l'oro per gli accenti (battuta,
 * time-out, set point), verde e rosso per chi entra e chi esce nei cambi. Le misure stanno nei componenti, in rem.
 */
export const NAVY = "#071733";
export const NAVY_DEEP = "#040d1f";
export const NAVY_LIGHT = "#10306a";
export const CLUB_BLUE = "#1c5bae";
export const GOLD = "#f5b700";
export const IN_GREEN = "#22c55e";
export const OUT_RED = "#ef4444";

/** Il fondo dei riquadri: un blu che scende verso il blu notte, con un filo di luce in alto. */
export const PANEL_BG = `linear-gradient(180deg, ${NAVY_LIGHT} 0%, ${NAVY} 62%, ${NAVY_DEEP} 100%)`;
export const SHADOW = "0 0.5rem 1.6rem rgba(0, 0, 0, 0.45)";
