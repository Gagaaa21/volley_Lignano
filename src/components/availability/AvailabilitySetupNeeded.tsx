import { Database } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

/** Cosa mostrare finché le tabelle dei link per i genitori non sono state create su Supabase (vedi isAvailabilityTableMissing). */
export function AvailabilitySetupNeeded({ isDev }: { isDev: boolean }) {
  return (
    <EmptyState
      icon={Database}
      title="Manca un'ultima configurazione"
      description={
        isDev ? (
          <>
            Per usare i link dei genitori servono due tabelle nel database, da creare una volta sola: apri Supabase → <b>SQL Editor</b>, incolla i blocchi{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">athlete_family_links</code> e{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">match_unavailability</code> di{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">supabase/schema.sql</code> e premi <b>Run</b>. Poi ricarica questa pagina.
          </>
        ) : (
          "I link per i genitori non sono ancora pronti: chiedi al Developer di completare la configurazione del database."
        )
      }
    />
  );
}
