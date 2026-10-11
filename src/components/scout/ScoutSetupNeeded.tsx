import { Database } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

/** Cosa mostrare finché la tabella dello scout non è stata creata su Supabase (vedi isScoutTableMissing). */
export function ScoutSetupNeeded({ isDev }: { isDev: boolean }) {
  return (
    <EmptyState
      icon={Database}
      title="Manca un'ultima configurazione"
      description={
        isDev ? (
          <>
            Per usare lo Scout serve creare una tabella nel database, una volta sola: apri Supabase → <b>SQL Editor</b>, incolla il blocco{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">match_scouts</code> di <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">supabase/schema.sql</code>{" "}
            e premi <b>Run</b>. Poi ricarica questa pagina.
          </>
        ) : (
          "Lo Scout non è ancora pronto: chiedi al Developer di completare la configurazione del database."
        )
      }
    />
  );
}
