import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { requireStaffPage } from "@/lib/auth/guard";
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
 * Scout. Non è pubblico: lo apre solo lo staff con il permesso «Scout» (il tablet resta collegato), e lo vede solo chi è in
 * palestra. Fuori dall'area riservata per non avere menu del sito né guida sopra: sempre scuro, a tutto schermo, senza barre di
 * scorrimento.
 */
export default async function TabellonePage() {
  await requireStaffPage("scout");
  return (
    <>
      <style>{"html,body{background:#050f18!important;margin:0!important;overflow:hidden!important}html{color-scheme:dark!important}"}</style>
      <Suspense fallback={null}>
        <TabelloneClient />
      </Suspense>
    </>
  );
}
