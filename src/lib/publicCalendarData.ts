import "server-only";
import { unstable_cache } from "next/cache";
import { getRepo } from "@/lib/db";
import type { AttendanceStatus, Category, TrainingTeam } from "@/lib/types";

/** Tag usato per invalidare la cache da ogni azione admin che tocca il
 * calendario pubblico (allenamenti, partite, schede collegate a una data,
 * registri presenze). */
export const PUBLIC_CALENDAR_TAG = "public-calendar";

export interface PublicAttendanceRecord {
  fullName: string;
  status: AttendanceStatus;
}

export interface PublicAttendanceSession {
  trainingRuleId: string;
  sessionDate: string;
  records: PublicAttendanceRecord[];
}

/** matchId -> nomi delle convocate, in ordine alfabetico. */
export type PublicCallUpsByMatchId = Record<string, string[]>;

/**
 * La home pubblica è l'unica pagina non autenticata del sito e riceve la
 * gran parte del traffico: senza cache, ogni visita rilegge tutto da
 * Supabase. Qui i dati restano validi 5 minuti (o finché un'azione admin
 * non invalida esplicitamente il tag) — chi ha attivato le notifiche viene
 * comunque avvisato subito di ogni cambiamento, quindi qualche minuto di
 * ritardo per chi sfoglia il calendario senza notifiche è un compromesso
 * ragionevole a fronte del traffico risparmiato verso il database.
 */
export const getPublicCalendarData = unstable_cache(
  async (from: string, to: string, category?: Category, team: TrainingTeam = "u14u15") => {
    const repo = await getRepo();
    const [trainings, matches, occurrencePlans, plans, athletes, attendanceSessions] =
      await Promise.all([
        repo.listTrainings({ team }),
        repo.listMatches({ team, from, to, category }),
        repo.listTrainingOccurrencePlans(),
        repo.listTrainingPlans({ team }),
        repo.listAthletes({ team }),
        repo.listAttendanceSessions({ team }),
      ]);

    // Il registro presenze è pubblico su richiesta esplicita del club (atlete
    // e famiglie devono poter vedere chi era presente a un allenamento, senza
    // login). Espone solo nome e stato: mai note interne o altri campi
    // dell'atleta, e solo per le sedute nel mese visibile.
    const athleteNameById = new Map(athletes.map((a) => [a.id, a.fullName] as const));
    const attendance: PublicAttendanceSession[] = attendanceSessions
      .filter((s) => s.trainingRuleId && s.sessionDate >= from && s.sessionDate <= to)
      .map((s) => ({
        trainingRuleId: s.trainingRuleId as string,
        sessionDate: s.sessionDate,
        records: Object.entries(s.records)
          .map(([athleteId, status]) => ({ fullName: athleteNameById.get(athleteId), status }))
          .filter((r): r is PublicAttendanceRecord => Boolean(r.fullName))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      }));

    // Le convocazioni sono pubbliche per lo stesso motivo delle presenze:
    // atlete e famiglie devono poter vedere chi è convocata per una partita
    // senza login. Espone solo il nome, mai l'id o altri campi dell'atleta.
    const callUpsByMatchId: PublicCallUpsByMatchId = {};
    for (const match of matches) {
      callUpsByMatchId[match.id] = match.calledUpAthleteIds
        .map((id) => athleteNameById.get(id))
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b));
    }

    return { trainings, matches, occurrencePlans, plans, attendance, callUpsByMatchId };
  },
  ["public-calendar-data"],
  { revalidate: 300, tags: [PUBLIC_CALENDAR_TAG] },
);

export interface SeasonRecord {
  category: Category;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
}

/**
 * Bilancio stagione (vittorie/sconfitte) per categoria, su tutte le
 * partite di campionato giocate finora — amichevoli e tornei esclusi:
 * per un torneo con più squadre un singolo "vinta/persa" non avrebbe
 * senso, ed è comunque un dato informale, non ufficiale. Guarda a tutta
 * la stagione (nessun intervallo di date), quindi resta una cache a
 * parte da getPublicCalendarData, che invece è sempre legata al mese
 * visibile nel calendario.
 */
export const getPublicSeasonRecord = unstable_cache(
  async (): Promise<SeasonRecord[]> => {
    const repo = await getRepo();
    // Il bilancio stagione riguarda solo la squadra U14/U15: il Minivolley
    // non ha una classifica di campionato con vittorie/sconfitte.
    const matches = await repo.listMatches({ team: "u14u15" });

    const byCategory: Record<Category, SeasonRecord> = {
      U14: { category: "U14", played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
      U15: { category: "U15", played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
    };

    for (const match of matches) {
      if (match.isFriendly || match.isTournament) continue;
      if (match.resultSetsWon === null || match.resultSetsLost === null) continue;
      if (!match.category) continue;

      const record = byCategory[match.category];
      record.played += 1;
      record.setsWon += match.resultSetsWon;
      record.setsLost += match.resultSetsLost;
      if (match.resultSetsWon > match.resultSetsLost) record.wins += 1;
      else record.losses += 1;
    }

    return Object.values(byCategory);
  },
  ["public-season-record"],
  { revalidate: 300, tags: [PUBLIC_CALENDAR_TAG] },
);
