import type { CategoryOfficial } from "@/lib/federation/load";
import { SectionHeading } from "@/components/ui/PageHeader";
import { OfficialCalendarImport } from "./OfficialCalendarImport";
import { OfficialDateChanges } from "./OfficialDateChanges";

/** Calendario ufficiale del girone: le partite della nostra squadra che nel
 * sito non ci sono ancora, da aggiungere con un clic e una conferma. */
export function OfficialCalendarSection({ official }: { official: CategoryOfficial[] }) {
  const entries = official.filter((entry) => entry.source.enabled && entry.calendar && entry.calendar.total > 0);
  if (entries.length === 0) return null;

  return (
    <section className="mb-8" aria-label="Calendario ufficiale">
      <SectionHeading
        title="Calendario ufficiale"
        description="Le partite di campionato lette dal portale: aggiungi quelle che mancano e aggiorna quelle spostate, nulla cambia senza la tua conferma."
      />
      <div className="space-y-5">
        {entries.map(({ source, calendar }) => (
          <div key={source.category} className="space-y-5">
            <OfficialDateChanges category={source.category} changes={calendar!.dateChanges} />
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
