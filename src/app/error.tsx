"use client";

import Image from "next/image";
import { RotateCcw } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";

// Rete di sicurezza per qualunque eccezione non gestita (es. Supabase
// irraggiungibile): senza questo file Next mostra la sua pagina di errore
// generica, senza stile e senza modo di riprovare.
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="auth-stage relative min-h-screen overflow-hidden">
      <Image src={crest} alt="" aria-hidden className="auth-stage-logo" />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[24rem]">
          <div className="auth-card p-6 text-center sm:p-8">
            <span className="brand-chip mx-auto h-16 w-16 rounded-2xl p-2">
              <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain" priority />
            </span>
            <p className="eyebrow mt-5 justify-center">Volley Lignano</p>
            <h1 className="display-wide mt-2 text-[1.75rem] leading-tight text-foreground">
              Qualcosa è andato storto
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Probabilmente un problema di connessione temporaneo. Riprova tra qualche istante.
            </p>

            <div className="mt-7" />

            <div className="flex flex-col gap-2.5">
              <Button type="button" onClick={() => retry()} className="w-full justify-center">
                <RotateCcw className="h-4 w-4" />
                Riprova
              </Button>
              <LinkButton href="/" variant="ghost" className="w-full justify-center">
                Torna al calendario
              </LinkButton>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
