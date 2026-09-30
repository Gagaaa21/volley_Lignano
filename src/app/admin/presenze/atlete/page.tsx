import type { Metadata } from "next";
import { ArrowLeft, Download, ListPlus, Plus, Users } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { AthleteList } from "./AthleteList";

export const metadata: Metadata = {
  title: "Atlete",
};

export default async function AthletesPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const athletes = await repo.listAthletes({ team });

  return (
    <div>
      <LinkButton href="/admin/presenze" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle presenze
      </LinkButton>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Users className="h-6 w-6 text-primary" />
            Atlete
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            L&apos;anagrafica usata per registrare le presenze agli allenamenti.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/api/presenze/atlete/csv" variant="ghost" size="sm">
            <Download className="h-4 w-4" />
            Esporta anagrafica
          </LinkButton>
          <LinkButton href="/api/presenze/riepilogo/csv" variant="ghost" size="sm">
            <Download className="h-4 w-4" />
            Riepilogo presenze
          </LinkButton>
          <LinkButton href="/admin/presenze/atlete/elenco" variant="outline">
            <ListPlus className="h-4 w-4" />
            Aggiungi in elenco
          </LinkButton>
          <LinkButton href="/admin/presenze/atlete/nuova">
            <Plus className="h-4 w-4" />
            Nuova atleta
          </LinkButton>
        </div>
      </div>

      {athletes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Nessuna atleta ancora. Aggiungi la prima per iniziare a registrare le presenze.
        </div>
      ) : (
        <div className="mt-6">
          <AthleteList athletes={athletes} team={team} />
        </div>
      )}
    </div>
  );
}
