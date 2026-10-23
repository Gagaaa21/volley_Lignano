import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Link2Off, Wrench } from "lucide-react";
import { getRepo } from "@/lib/db";
import { matchTitle } from "@/lib/calendar";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { canUseFamilyLink, matchesForAthlete } from "@/lib/availability/rules";
import { isFamilyToken } from "@/lib/availability/token";
import { nowLocalIso } from "@/lib/today";
import type { Athlete } from "@/lib/types";
import { AvailabilityPanel, type FamilyMatchItem } from "@/components/availability/AvailabilityPanel";
import { FamilyShell } from "@/components/availability/FamilyShell";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { EmptyState } from "@/components/ui/EmptyState";

// Un titolo e una descrizione uguali per tutti: l'anteprima di WhatsApp non deve mai mostrare il nome di un'atleta. La pagina
// non va sui motori di ricerca e non passa il suo indirizzo (che contiene il codice) ai siti verso cui porta.
export const metadata: Metadata = {
  title: "Disponibilità",
  description: "Segna le partite a cui non puoi esserci.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Cambia a ogni visita e dipende dal codice: mai in cache.
export const dynamic = "force-dynamic";

function InvalidLink() {
  return (
    <FamilyShell>
      <EmptyState
        icon={Link2Off}
        title="Questo link non funziona"
        description="Può essere sbagliato o essere stato sostituito da uno nuovo. Chiedi all'allenatore di mandartelo di nuovo."
      />
    </FamilyShell>
  );
}

function NotReady() {
  return (
    <FamilyShell>
      <EmptyState
        icon={Wrench}
        title="Il servizio non è ancora attivo"
        description="Riprova più tardi, oppure sentite l'allenatore."
      />
    </FamilyShell>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default async function FamilyAvailabilityPage({ params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  // Un indirizzo inventato non arriva nemmeno al database; e ogni caso sbagliato mostra la stessa cosa.
  if (!isFamilyToken(codice)) return <InvalidLink />;

  // Sempre il database reale: chi apre un link non ha una sessione, e non dipende dalla modalità prova di nessuno.
  const repo = await getRepo();
  let athlete: Athlete | null;
  try {
    athlete = await repo.findAthleteByFamilyToken(codice);
  } catch (error) {
    if (!isAvailabilityTableMissing(error)) throw error;
    return <NotReady />;
  }
  if (!athlete || !canUseFamilyLink(athlete)) return <InvalidLink />;

  const now = nowLocalIso();
  const options = matchesForAthlete(athlete, await repo.listMatches({ team: athlete.team, from: now.slice(0, 10) }), now);
  const reports = await repo.listMatchUnavailability({ athleteId: athlete.id, matchIds: options.map(({ match }) => match.id) });
  const reportByMatch = new Map(reports.map((report) => [report.matchId, report] as const));

  // Solo quello che serve a mostrare le partite: mai chi è convocata né altri dati.
  const items: FamilyMatchItem[] = options.map(({ match, open }) => {
    const report = reportByMatch.get(match.id);
    const meeting = [match.meetingTime ? `ore ${match.meetingTime}` : null, match.meetingLocation].filter(Boolean).join(" · ");
    return {
      matchId: match.id,
      title: matchTitle(match),
      dateLabel: capitalize(format(parseISO(match.matchDate.slice(0, 10)), "EEEE d MMMM", { locale: it })),
      timeLabel: match.matchDate.slice(11, 16),
      place: match.location,
      homeAway: match.isHome ? "Casa" : "Trasferta",
      kind: match.isTournament ? "Torneo" : match.isFriendly ? "Amichevole" : null,
      meeting: meeting || null,
      open,
      report: report ? { reason: report.reason, note: report.note, reportedBy: report.reportedBy } : null,
    };
  });

  return (
    <FamilyShell>
      <p className="eyebrow">Disponibilità per le partite</p>
      <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl" data-family-athlete>
        {athlete.fullName}
        <CategoryTag category={athlete.category} size="md" long />
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Tocca <b className="font-semibold text-foreground/80">Non ci sarà</b> sulle partite a cui non può esserci: l&apos;allenatore lo vede subito. Se non
        dici niente, conta su di lei. Puoi modificare o togliere la segnalazione quando vuoi, fino all&apos;inizio della partita.
      </p>

      <div className="mt-6">
        <AvailabilityPanel token={codice} items={items} />
      </div>

      <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
        Questo link è personale: non condividerlo con altri. Se lo perdi o pensi che sia finito in mani sbagliate, dillo all&apos;allenatore: ne prepara uno
        nuovo e questo smette di funzionare.
      </p>
    </FamilyShell>
  );
}
