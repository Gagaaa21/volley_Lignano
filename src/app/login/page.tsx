import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
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
        <div className="w-full max-w-[24rem]">
          <div className="auth-card p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="brand-chip h-16 w-16 rounded-2xl p-2">
                <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain" priority />
              </span>
              <p className="eyebrow mt-5">Volley Lignano</p>
              <h1 className="display-wide mt-2 text-[2rem] leading-none text-foreground">Area tecnici</h1>
              <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
                Accedi per gestire allenamenti, partite e presenze.
              </p>
            </div>

            <div className="mt-7">
              <LoginForm />
            </div>

            <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
              Credenziali dimenticate? Chiedi a un amministratore del club.
            </p>
          </div>

          <Link
            href="/"
            className="mx-auto mt-6 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Calendario pubblico
          </Link>
        </div>
      </main>
    </div>
  );
}
