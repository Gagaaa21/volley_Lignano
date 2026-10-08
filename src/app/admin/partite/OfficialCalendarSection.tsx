import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { CategoryOfficial } from "@/lib/federation/load";
import { SectionHeading } from "@/components/ui/PageHeader";
import { OfficialCalendarImport } from "./OfficialCalendarImport";
import { OfficialGameChanges } from "./OfficialGameChanges";

/** Calendario ufficiale del girone: le partite della nostra squadra che nel
 * sito non ci sono ancora, da aggiungere con un clic e una conferma. */
export function OfficialCalendarSection({ official }: { official: CategoryOfficial[] }) {
  const entries = official.filter((entry) => entry.source.enabled && entry.calendar && entry.calendar.total > 0);
  if (entries.length === 0) return null;

  return (
    <section className="mb-8" aria-label="Calendario ufficiale">
      <SectionHeading
        title="Calendario ufficiale"
        description="Le partite di campionato lette dal portale. Aggiungere quelle che non hai inserito è facoltativo: ti avviso solo se una partita già nel sito ha data o avversaria diverse dal portale. Nulla cambia senza la tua conferma."
      />
      <div className="space-y-5">
        {entries.map(({ source, calendar }) => (
          <div key={source.category} className="space-y-5">
            <OfficialGameChanges category={source.category} changes={calendar!.changes} />
            {calendar!.orphans.length > 0 && (
              <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm" data-official-orphans={source.category}>
                <p className="flex items-center gap-2 font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  {CATEGORY_LABELS[source.category]}:{" "}
                  {calendar!.orphans.length === 1
                    ? "una partita del sito non corrisponde a nessuna gara ufficiale"
                    : `${calendar!.orphans.length} partite del sito non corrispondono a nessuna gara ufficiale`}
                </p>
                <ul className="mt-1.5 space-y-0.5 text-foreground/80">
                  {calendar!.orphans.map(({ match }) => (
                    <li key={match.id}>
                      <Link href={`/admin/partite/${match.id}`} className="font-semibold text-primary hover:underline">
                        vs {match.opponent}
                      </Link>{" "}
                      · {match.isHome ? "in casa" : "in trasferta"} ·{" "}
                      {format(parseISO(match.matchDate.slice(0, 10)), "EEE d MMM", { locale: it })} · ore{" "}
                      {match.matchDate.slice(11, 16)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Nel calendario ufficiale della nostra squadra non c&apos;è una gara con questa avversaria in questo
                  giorno: controlla se la partita è stata cancellata o sostituita e, se serve, eliminala o correggila
                  dalla sua scheda (clic sul nome).
                </p>
              </div>
            )}
            <OfficialCalendarImport
              category={source.category}
              items={calendar!.items}
              alreadyPresent={calendar!.alreadyPresent}
              total={calendar!.total}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
