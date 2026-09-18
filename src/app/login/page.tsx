import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Waves } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Accedi",
};

export default function LoginPage() {
  return (
    <div className="auth-stage relative min-h-screen overflow-hidden">
      <Image src={crest} alt="" aria-hidden className="auth-stage-logo" />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[25rem]">
          <div className="auth-card p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="brand-chip h-16 w-16">
                <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain" priority />
              </span>
              <p className="eyebrow mt-5">Volley Lignano · Lignano Sabbiadoro</p>
              <p className="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
                Area riservata
              </p>
              <h1 className="mt-2.5 font-display text-[1.7rem] leading-tight tracking-tight sm:text-3xl">
                Bentornato
              </h1>
              <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-muted-foreground">
                Accesso riservato a Developer e Admin. Inserisci le tue credenziali per continuare.
              </p>
            </div>

            <div className="my-6 h-px bg-border/70" />

            <LoginForm />
          </div>

          <div className="mt-7 space-y-2 text-center text-sea-200/80">
            <p className="rule-center">Assistenza</p>
            <p className="text-xs leading-relaxed text-sea-100/60">
              Credenziali dimenticate? Contatta un amministratore del club.
            </p>
            <p className="pt-2 text-sm text-sea-100/70">
              Sei un genitore o un&apos;atleta?{" "}
              <Link href="/" className="font-semibold text-white hover:underline">
                Vai al calendario pubblico
              </Link>
            </p>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-sea-200/50">
            <Waves className="h-3.5 w-3.5" />
            Lignano Sabbiadoro
          </p>
        </div>
      </main>
    </div>
  );
}
