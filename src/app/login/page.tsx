import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Waves } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Accedi",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-sea-600 via-sea-700 to-sea-950 p-10 text-white lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 35%), radial-gradient(circle at 80% 60%, white 0, transparent 40%)",
          }}
        />
        <Logo variant="inverted" />
        <div className="relative z-10 max-w-md">
          <span className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <ShieldCheck className="h-7 w-7" strokeWidth={2} />
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Area riservata dello staff
          </h1>
          <p className="mt-4 text-base text-sea-100/90">
            Gestisci calendario, allenamenti e partite delle squadre Under 14 e Under 15.
            Accesso riservato a Developer e Admin.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-sm text-sea-200/80">
          <Waves className="h-4 w-4" />
          Lignano Sabbiadoro
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">Accedi</h2>
          <p className="mt-1.5 text-sm text-foreground/60">
            Inserisci le credenziali fornite dal club per accedere al pannello di gestione.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
          <p className="mt-8 text-center text-sm text-foreground/50">
            Sei un genitore o un&apos;atleta?{" "}
            <Link href="/" className="font-medium text-sea-700 hover:underline">
              Vai al calendario pubblico
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
