import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import crest from "@/assets/lignano-crest.png";
import { DirettaClient } from "./DirettaClient";
import { ShareButton } from "./ShareButton";

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
        <Link prefetch={false} href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Torna al calendario">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-border">
            <Image src={crest} alt="" unoptimized className="h-full w-full object-contain" />
          </span>
          {/* Sui telefoni stretti c'è posto solo per lo stemma accanto a «Condividi» e «Calendario». */}
          <span className="hidden truncate font-display text-lg font-extrabold text-foreground min-[440px]:inline">Volley Lignano</span>
        </Link>
        <span className="flex shrink-0 items-center gap-1">
          <ShareButton />
          <Link prefetch={false} href="/" className="hit-area relative rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary hover:bg-primary-soft">
            Calendario
          </Link>
        </span>
      </header>
      <DirettaClient />
    </main>
  );
}
