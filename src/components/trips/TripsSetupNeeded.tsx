import { Database } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

/** Cosa mostrare finché le tabelle delle trasferte non sono state create su Supabase (vedi isTripTableMissing). */
export function TripsSetupNeeded({ isDev }: { isDev: boolean }) {
  return (
    <EmptyState
      icon={Database}
      title="Manca un'ultima configurazione"
      description={
        isDev ? (
          <>
            Per usare le Trasferte servono due tabelle nel database, da creare una volta sola: apri Supabase → <b>SQL Editor</b>, incolla i blocchi{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">match_trips</code> e{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">athlete_contacts</code> di{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">supabase/schema.sql</code> e premi <b>Run</b>. Poi ricarica questa pagina.
          </>
        ) : (
          "Le Trasferte non sono ancora pronte: chiedi al Developer di completare la configurazione del database."
        )
      }
    />
  );
}
