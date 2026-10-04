import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { CATEGORY_DOT, CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { isOurTeam } from "@/lib/federation/matching";
import { SectionHeading } from "@/components/ui/PageHeader";
import type { PublicStandings } from "@/lib/publicCalendarData";

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "federazione";
  }
}

/**
 * Classifica del girone per categoria, dai dati ufficiali della federazione
 * (letti in src/lib/federation). Prima della prima giornata si mostrano solo
 * le squadre iscritte e la data d'inizio invece di una tabella di zeri; una
 * categoria senza girone pubblicato non compare, e la sezione sparisce se
 * non c'è nulla da mostrare.
 */
export function StandingsSection({ standings }: { standings: PublicStandings[] }) {
  if (standings.length === 0) return null;

  return (
    <section className="mt-12" aria-label="Classifica">
      <SectionHeading
        title="Classifica"
        description="Il girone di campionato, con i dati ufficiali della federazione."
      />
      <div className={cn("grid gap-4", standings.length > 1 && "lg:grid-cols-2")}>
        {standings.map((entry) => {
          const stale = entry.stale;
          return (
            <div
              key={entry.category}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
            >
              <span className={cn("absolute inset-x-0 top-0 h-1", CATEGORY_DOT[entry.category])} aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                  <span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_DOT[entry.category])} aria-hidden />
                  {CATEGORY_LABELS[entry.category]}
                </p>
                <p className="text-[13px] font-medium text-muted-foreground">{entry.rows.length} squadre</p>
              </div>

              {entry.started ? (
                <div className="-mx-1 mt-4 overflow-x-auto px-1">
                  <table className="tabular w-full min-w-[17rem] text-sm">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        <th scope="col" className="w-8 pb-2 text-left">
                          <abbr title="Posizione" className="no-underline">
                            #
                          </abbr>
                        </th>
                        <th scope="col" className="pb-2 text-left">
                          Squadra
                        </th>
                        <th scope="col" className="w-8 pb-2 text-right">
                          <abbr title="Punti" className="no-underline">
                            Pt
                          </abbr>
                        </th>
                        <th scope="col" className="w-8 pb-2 text-right">
                          <abbr title="Partite giocate" className="no-underline">
                            G
                          </abbr>
                        </th>
                        <th scope="col" className="w-8 pb-2 text-right">
                          <abbr title="Vinte" className="no-underline">
                            V
                          </abbr>
                        </th>
                        <th scope="col" className="w-8 pb-2 text-right">
                          <abbr title="Perse" className="no-underline">
                            P
                          </abbr>
                        </th>
                        <th scope="col" className="hidden w-16 pb-2 text-right sm:table-cell">
                          <abbr title="Set vinti e persi" className="no-underline">
                            Set
                          </abbr>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {entry.rows.map((row) => {
                        const ours = isOurTeam(row.team, entry.teamAliases);
                        return (
                          <tr
                            key={row.position}
                            className={cn(ours && "bg-primary-soft font-bold text-primary")}
                            aria-current={ours ? "true" : undefined}
                          >
                            <td className="rounded-l-lg py-2 pl-1.5 text-left">{row.position}</td>
                            <td className="py-2 pr-2 text-left">{row.team}</td>
                            <td className="py-2 text-right font-bold">{row.points}</td>
                            <td className="py-2 text-right">{row.played}</td>
                            <td className="py-2 text-right">{row.won}</td>
                            <td className="py-2 text-right">{row.lost}</td>
                            <td className="hidden rounded-r-lg py-2 pr-1.5 text-right sm:table-cell">
                              {row.setsFor}–{row.setsAgainst}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.firstMatchDate
                      ? `Il campionato inizia il ${format(parseISO(entry.firstMatchDate), "d MMMM", { locale: it })}.`
                      : "Il campionato non è ancora iniziato."}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {entry.rows.map((row) => (
                      <li
                        key={row.position}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-[13px] font-medium",
                          isOurTeam(row.team, entry.teamAliases)
                            ? "bg-primary-soft font-bold text-primary"
                            : "bg-muted text-foreground/75",
                        )}
                      >
                        {row.team}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className={cn("mt-4 text-xs", stale ? "font-semibold text-warning" : "text-muted-foreground")}>
                {entry.fetchedAt
                  ? `${stale ? "Dati non aggiornati dal" : "Aggiornata il"} ${formatMoment(entry.fetchedAt)}`
                  : "Non ancora aggiornata"}
                {" · "}
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
                >
                  Fonte: FIPAV ({hostOf(entry.sourceUrl)})
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
