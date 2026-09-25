import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// Sostituisce solo manifest e identità PWA per questo ramo: Minivolley è
// installabile come app a parte, con la sua icona (il logo Volley S3) e il
// suo nome nella schermata Home, separata dall'app principale U14/U15.
export const metadata: Metadata = {
  title: { absolute: "Volley Lignano S3" },
  manifest: "/manifest-s3.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Volley S3",
  },
};

// Colore della barra del browser/status bar quando il sito Minivolley è
// aperto (o installato come PWA): il corallo del tema Minivolley, non il
// blu del sito principale (vedi manifest-s3.webmanifest per la stessa
// coerenza da app installata).
export const viewport: Viewport = {
  themeColor: "#ac3212",
};

export default function MinivolleyLayout({ children }: { children: ReactNode }) {
  // data-theme="minivolley" attiva il tema colori+font dedicato definito in
  // globals.css: da qui in giù ogni componente condiviso (calendario,
  // pulsanti, badge) si ritema da solo, rendendo il sito visivamente
  // inconfondibile rispetto a quello U14/U15 — utile allo staff per
  // riconoscere subito su quale sito si trova.
  return <div data-theme="minivolley">{children}</div>;
}
