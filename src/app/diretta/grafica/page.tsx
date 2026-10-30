import type { Metadata } from "next";
import { Suspense } from "react";
import { GraficaClient } from "./GraficaClient";

export const metadata: Metadata = {
  title: "Grafica diretta",
  robots: { index: false, follow: false },
};

/**
 * Pagina per OBS (vedi GraficaClient) e per il riquadro sopra il lettore della pagina /diretta: non è fatta per essere aperta dai
 * visitatori. Lo sfondo del sito va tolto prima di tutto il resto, così al caricamento non lampeggia un riquadro pieno sopra il
 * video. Lo schema colori è sempre «chiaro», come quello del riquadro che la contiene: se i due non coincidono (tema scuro del
 * sito) il browser dipinge il riquadro con uno sfondo pieno e il video sparisce. Niente margini e niente barre di scorrimento,
 * anche se nella sorgente di Streamlabs / OBS qualcuno ha cancellato il CSS personalizzato che le toglie: una barra ruberebbe
 * spazio e taglierebbe il lato destro della grafica.
 */
export default function GraficaPage() {
  return (
    <>
      <style>{"html,body{background:transparent!important;margin:0!important;overflow:hidden!important}html{color-scheme:light!important}"}</style>
      <Suspense fallback={null}>
        <GraficaClient />
      </Suspense>
    </>
  );
}
