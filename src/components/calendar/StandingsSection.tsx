import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { CATEGORY_DOT, CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { isOurTeam } from "@/lib/federation/matching";
import { manualLogoFor } from "@/components/calendar/manualTeamLogos";
import { TeamLogo } from "@/components/calendar/TeamLogo";
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
 * (letti in src/lib/federation), con il logo di ogni squadra: quello preso
 * dal portale, tranne per la nostra che usa lo stemma del sito. Prima della
 * prima giornata si mostrano solo le squadre iscritte e la data d'inizio
 * invece di una tabella di zeri; una categoria senza girone pubblicato non
 * compare, e la sezione sparisce se non c'è nulla da mostrare.
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
                <>
                  <div className="-mx-1 mt-4 overflow-x-auto px-1">
                    <table className="tabular w-full text-sm">
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
                          <th scope="col" className="w-9 pb-2 text-right">
                            <abbr title="Punti" className="no-underline">
                              Pt
                            </abbr>
                          </th>
                          <th scope="col" className="w-7 pb-2 text-right">
                            <abbr title="Partite giocate" className="no-underline">
                              G
                            </abbr>
                          </th>
                          <th scope="col" className="w-7 pb-2 text-right">
                            <abbr title="Vinte" className="no-underline">
                              V
                            </abbr>
                          </th>
                          <th scope="col" className="w-9 pb-2 pr-1.5 text-right sm:w-7 sm:pr-0">
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
                              <td className="rounded-l-lg py-2 pl-1.5 text-left">
                                <span
                                  className={cn(
                                    "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                                    row.zone === "promotion" ? "bg-success text-white" : "bg-muted text-foreground/70",
                                  )}
                                >
                                  {row.position}
                                </span>
                              </td>
                              <td className="py-2 pr-1">
                                <div className="flex items-center gap-2">
                                  <TeamLogo
                                    src={row.logoUrl}
                                    name={row.team}
                                    ours={ours}
                                    localLogo={manualLogoFor(row.team)}
                                    className="h-7 w-7 sm:h-9 sm:w-9"
                                  />
                                  <div className="min-w-0 leading-tight">
                                    <p className="text-[13px] font-semibold sm:text-sm">{row.team}</p>
                                    {row.penalty !== 0 && (
                                      <p className="mt-0.5 text-[11px] font-medium text-warning">
                                        Penalizzazione −{Math.abs(row.penalty)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 text-right font-display text-base font-bold">{row.points}</td>
                              <td className="py-2 text-right">{row.played}</td>
                              <td className="py-2 text-right">{row.won}</td>
                              <td className="rounded-r-lg py-2 pr-1.5 text-right sm:rounded-none sm:pr-0">
                                {row.lost}
                              </td>
                              <td className="hidden rounded-r-lg py-2 pr-1.5 text-right sm:table-cell">
                                {row.setsFor}–{row.setsAgainst}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {entry.rows.some((row) => row.zone === "promotion") && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                        Zona promozione
                      </span>
                    )}
                    <span>
                      Pt punti · G giocate · V vinte · P perse
                      <span className="hidden sm:inline"> · Set vinti–persi</span>
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.firstMatchDate
                      ? `Il campionato inizia il ${format(parseISO(entry.firstMatchDate), "d MMMM", { locale: it })}.`
                      : "Il campionato non è ancora iniziato."}
                  </p>
                  <ul className="mt-3 grid gap-2 min-[420px]:grid-cols-2">
                    {entry.rows.map((row) => {
                      const ours = isOurTeam(row.team, entry.teamAliases);
                      return (
                        <li
                          key={row.position}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold leading-tight",
                            ours ? "bg-primary-soft font-bold text-primary" : "bg-muted text-foreground/80",
                          )}
                        >
                          <TeamLogo
                            src={row.logoUrl}
                            name={row.team}
                            ours={ours}
                            localLogo={manualLogoFor(row.team)}
                            className="h-8 w-8"
                          />
                          <span className="min-w-0">{row.team}</span>
                        </li>
                      );
                    })}
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
