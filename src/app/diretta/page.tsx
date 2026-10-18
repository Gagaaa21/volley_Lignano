import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import crest from "@/assets/lignano-crest.png";
import { DirettaClient } from "./DirettaClient";

export const metadata: Metadata = {
  title: "Diretta",
  description: "La partita di Volley Lignano in diretta, con il punteggio.",
  robots: { index: false, follow: false },
};

/** La pagina dei genitori: il video della diretta con il punteggio dello Scout sopra (vedi DirettaClient). Statica: i dati arrivano da /api/diretta. */
export default function DirettaPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Torna al calendario">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-border">
            <Image src={crest} alt="" unoptimized className="h-full w-full object-contain" />
          </span>
          <span className="truncate font-display text-lg font-extrabold text-foreground">Volley Lignano</span>
        </Link>
        <Link href="/" className="shrink-0 text-sm font-semibold text-primary hover:underline">
          Calendario
        </Link>
      </header>
      <DirettaClient />
    </main>
  );
}
