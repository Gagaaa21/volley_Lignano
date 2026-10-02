import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { AthletePicker } from "./AthletePicker";

export const metadata: Metadata = {
  title: "Nuovo test fisico",
};

export default async function NewPhysicalTestPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const athletes = await repo.listAthletes({ team });

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/test-fisici" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna ai test fisici
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Nuovo test fisico</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Scegli l&apos;atleta a cui assegnare il test: i dati da inserire compaiono dopo.
      </p>

      {athletes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Serve prima un&apos;atleta in anagrafica.{" "}
          <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
            Aggiungine una
          </Link>
          .
        </div>
      ) : (
        <div className="mt-6">
          <AthletePicker athletes={athletes} />
        </div>
      )}
    </div>
  );
}
