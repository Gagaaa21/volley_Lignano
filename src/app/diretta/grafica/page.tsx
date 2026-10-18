import type { Metadata } from "next";
import { Suspense } from "react";
import { GraficaClient } from "./GraficaClient";

export const metadata: Metadata = {
  title: "Grafica diretta",
  robots: { index: false, follow: false },
};

/**
 * Pagina per OBS (vedi GraficaClient): non è fatta per essere aperta dai visitatori. Lo sfondo del sito va tolto prima di
 * tutto il resto, così al caricamento non lampeggia un riquadro pieno sopra il video.
 */
export default function GraficaPage() {
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <Suspense fallback={null}>
        <GraficaClient />
      </Suspense>
    </>
  );
}
