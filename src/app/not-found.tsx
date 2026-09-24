import Image from "next/image";
import { CalendarDays, Waves } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { LinkButton } from "@/components/ui/LinkButton";

export default function NotFound() {
  return (
    <div className="auth-stage relative min-h-screen overflow-hidden">
      <Image src={crest} alt="" aria-hidden className="auth-stage-logo" />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[25rem]">
          <div className="auth-card p-6 text-center sm:p-8">
            <span className="brand-chip mx-auto h-16 w-16">
              <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain" priority />
            </span>
            <p className="eyebrow mt-5 justify-center">Volley Lignano · Lignano Sabbiadoro</p>
            <h1 className="mt-2.5 font-display text-[1.7rem] leading-tight tracking-tight sm:text-3xl">
              Pagina non trovata
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Il link potrebbe essere scaduto o l&apos;evento non è più in calendario.
            </p>

            <div className="my-6 h-px bg-border/70" />

            <LinkButton href="/" className="w-full justify-center">
              <CalendarDays className="h-4 w-4" />
              Torna al calendario
            </LinkButton>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-foreground/35">
            <Waves className="h-3.5 w-3.5" />
            Lignano Sabbiadoro
          </p>
        </div>
      </main>
    </div>
  );
}
