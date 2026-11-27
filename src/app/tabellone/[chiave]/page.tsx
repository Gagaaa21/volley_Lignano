import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isBoardKey } from "@/lib/scout/boardLink";
import { TabelloneClient } from "../TabelloneClient";

export const metadata: Metadata = {
  title: "Tabellone",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#050f18",
};

/**
 * Il tabellone per la palestra (vedi TabelloneClient): un tablet al posto del tabellone segnapunti, con il punteggio dello
 * Scout. Non è sul sito pubblico e non chiede l'accesso: si apre solo con il link con la chiave (vedi boardLink.ts), che lo staff
 * trova nello Scout. Fuori dall'area riservata, senza menu né guida: a tutto schermo, senza barre di scorrimento.
 */
export default async function TabellonePage({ params }: { params: Promise<{ chiave: string }> }) {
  const { chiave } = await params;
  if (!isBoardKey(chiave)) notFound();
  return (
    <>
      <style>{"html,body{margin:0!important;overflow:hidden!important}"}</style>
      <Suspense fallback={null}>
        <TabelloneClient chiave={chiave} />
      </Suspense>
    </>
  );
}
