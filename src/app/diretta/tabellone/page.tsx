import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { TabelloneClient } from "./TabelloneClient";

export const metadata: Metadata = {
  title: "Tabellone",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050f18",
};

/**
 * Il tabellone per la palestra (vedi TabelloneClient): un tablet al posto del tabellone segnapunti, con il punteggio dello
 * Scout. Sempre scuro, a tutto schermo, senza menu del sito né barre di scorrimento.
 */
export default function TabellonePage() {
  return (
    <>
      <style>{"html,body{background:#050f18!important;margin:0!important;overflow:hidden!important}html{color-scheme:dark!important}"}</style>
      <Suspense fallback={null}>
        <TabelloneClient />
      </Suspense>
    </>
  );
}
