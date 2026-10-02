import { Lilita_One } from "next/font/google";

// Carattere tondo e "gommoso" da videogioco per titoli, nome e pulsanti del
// tour di Gem. Caricato solo dove il tour viene montato (pagina Test
// fisici), non in tutto il sito come i caratteri del layout radice.
export const clashFont = Lilita_One({
  variable: "--font-clash",
  subsets: ["latin"],
  weight: "400",
});
