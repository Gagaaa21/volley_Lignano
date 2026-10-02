import type { Metadata } from "next";
import Link from "next/link";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader
        back={{ href: "/admin/test-fisici", label: "Test fisici" }}
        title="Nuovo test"
        description="Scegli l'atleta: i dati da inserire compaiono dopo."
      />

      {athletes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Serve prima un&apos;atleta in anagrafica.{" "}
          <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
            Aggiungine una
          </Link>
          .
        </div>
      ) : (
        <AthletePicker athletes={athletes} />
      )}
    </div>
  );
}
