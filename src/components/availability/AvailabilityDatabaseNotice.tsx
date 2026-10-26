import { Database } from "lucide-react";
import { AVAILABILITY_TABLE_PURPOSE, setupSqlFor, type AvailabilityTable } from "@/lib/availability/setupSql";
import { CopyTextButton } from "@/components/ui/CopyTextButton";

/**
 * Cosa manca nel database per le assenze alle partite. Al Developer dice quali tabelle e gli dà l'SQL già pronto da copiare e incollare
 * nell'SQL Editor di Supabase; agli altri dice di chiederglielo. Il sito si aggiorna da solo a ogni pubblicazione, le tabelle no: così
 * non resta nascosto (i genitori vedrebbero solo «Il servizio non è ancora attivo»).
 */
export function AvailabilityDatabaseNotice({ missing, isDev }: { missing: readonly AvailabilityTable[]; isDev: boolean }) {
  if (missing.length === 0) return null;
  const sql = setupSqlFor(missing);

  return (
    <section
      className="mb-6 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-4 text-sm text-foreground sm:px-5"
      data-availability-db-missing={missing.join(" ")}
    >
      <p className="flex items-start gap-2.5 font-semibold">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        Manca un pezzo del database: {missing.map((table) => AVAILABILITY_TABLE_PURPOSE[table]).join(", ")}.
      </p>
      {isDev ? (
        <>
          <p className="mt-2 leading-relaxed text-foreground/80">
            Finché non c&apos;è, i genitori vedono «Il servizio non è ancora attivo». Apri Supabase → <b>SQL Editor</b> → <b>New query</b>, incolla
            questo SQL, premi <b>Run</b> (deve dire «Success») e ricarica la pagina. Si può rieseguire senza danni.
          </p>
          <pre
            className="mt-3 max-h-64 overflow-auto rounded-xl border border-border bg-surface px-3.5 py-3 font-mono text-[12px] leading-relaxed text-foreground/85"
            data-availability-db-sql
          >
            {sql}
          </pre>
          <div className="mt-3">
            <CopyTextButton text={sql} data-availability-db-copy>
              Copia l&apos;SQL
            </CopyTextButton>
          </div>
        </>
      ) : (
        <p className="mt-2 leading-relaxed text-foreground/80">
          Finché non c&apos;è, i genitori non possono segnalare le assenze: chiedi al Developer di completare la configurazione del database.
        </p>
      )}
    </section>
  );
}
