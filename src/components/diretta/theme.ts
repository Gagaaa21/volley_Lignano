/**
 * I colori e i materiali del pacchetto grafico della diretta video, come in TV: riquadri di un blu profondo e lucido (più
 * chiaro in alto, con un filo di luce sul bordo e l'ombra sotto, così hanno spessore), tagli obliqui, e pochi accenti vivi:
 * il giallo del sole dello stemma per quello che conta (set, punti, etichette), l'azzurro del mare, il tramonto arancio-rosa
 * per i momenti caldi (set point, serie), verde e rosso per chi entra e chi esce. Le misure stanno nei componenti, in rem.
 */
export const NIGHT = "#050d2a";
export const INK = "#0b1b4d";
export const DEEP = "#0f2a78";
export const ROYAL = "#1d4ed8";
export const AZURE = "#2f80ed";
export const SKY = "#22b8f0";
export const SUN = "#ffd23f";
export const ORANGE = "#ff8a3d";
export const PINK = "#ff4f8b";
export const VIOLET = "#8b5cf6";
export const IN_GREEN = "#2ee07a";
export const OUT_RED = "#ff4d5e";

/** Il materiale dei riquadri: blu profondo, più chiaro in alto (la luce viene da sopra). */
export const GLASS = "linear-gradient(180deg, #1d43b0 0%, #133192 46%, #0c2166 100%)";
/** La fascia più scura sotto la testata (tabelle, righe dei cambi, parziali). */
export const GLASS_DARK = "linear-gradient(180deg, rgba(6,16,52,0.94) 0%, rgba(9,24,72,0.94) 100%)";
/** Il filo di luce in alto e quello d'ombra in basso: lo spessore del riquadro. */
export const EDGE = "inset 0 0.09rem 0 rgba(255,255,255,0.3), inset 0 -0.09rem 0 rgba(0,0,0,0.35)";
/** L'ombra sotto i riquadri (con clip-path l'ombra si fa con filter: drop-shadow, vedi DROP). */
export const SHADOW = "0 0.7rem 2rem rgba(3, 10, 40, 0.55)";
export const DROP = "drop-shadow(0 0.6rem 1.2rem rgba(3, 10, 40, 0.55))";
/** Il bianco dei riquadri dei punti: appena azzurrato in basso. */
export const PAPER = "linear-gradient(180deg, #ffffff 0%, #e6edff 100%)";
/** Le etichette calde: il tramonto. */
export const SUNSET = `linear-gradient(90deg, ${SUN} 0%, ${ORANGE} 55%, ${PINK} 100%)`;
/** L'etichetta gialla: il sole, con un filo più caldo a destra. */
export const GOLD = `linear-gradient(90deg, ${SUN} 0%, #ffc21a 100%)`;
/** Il taglio obliquo a destra di un riquadro (alto quanto il riquadro): `size` è quanto rientra in basso. */
export const cutRight = (size = "1rem") => `polygon(0 0, 100% 0, calc(100% - ${size}) 100%, 0 100%)`;
/** Un'etichetta a parallelogramma. */
export const tag = (size = "0.7rem") => `polygon(${size} 0, 100% 0, calc(100% - ${size}) 100%, 0 100%)`;
/** I colori dei coriandoli. */
export const PARTY = [SUN, ORANGE, PINK, SKY, IN_GREEN, "#ffffff", VIOLET];
