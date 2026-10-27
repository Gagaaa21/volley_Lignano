import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Info, Link2Off, PauseCircle, Wrench } from "lucide-react";
import { getRepo } from "@/lib/db";
import { matchTitle } from "@/lib/calendar";
import { isAppSettingsMissing, isAvailabilityTableMissing } from "@/lib/availability/missing";
import { DEFAULT_REPORTING_POLICY, byPhrase, fromLabel, parentClosedNote, type ReportingPolicy } from "@/lib/availability/reporting";
import { canUseFamilyLink, isAbsence, matchesForAthlete, staffNamesById } from "@/lib/availability/rules";
import { answerWhen, deadlineLabel } from "@/lib/availability/format";
import { isFamilyToken } from "@/lib/availability/token";
import { certificateStatus, dayLabel, statusLabel, type MedicalCertificate } from "@/lib/medical/certificate";
import { nowLocalIso, todayIso } from "@/lib/today";
import type { Athlete } from "@/lib/types";
import { AvailabilityPanel, type FamilyMatchItem } from "@/components/availability/AvailabilityPanel";
import { FamilyShell } from "@/components/availability/FamilyShell";
import { FamilyCertificateCard } from "@/components/medical/FamilyCertificateCard";
import { saveFamilyCertificateAction } from "./actions";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { EmptyState } from "@/components/ui/EmptyState";

// Un titolo e una descrizione uguali per tutti: l'anteprima di WhatsApp non deve mai mostrare il nome di un'atleta. La pagina
// non va sui motori di ricerca e non passa il suo indirizzo (che contiene il codice) ai siti verso cui porta.
export const metadata: Metadata = {
  title: "Assenze alle partite",
  description: "Segnala le partite a cui non ci sarà.",
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
  const upcoming = await repo.listMatches({ team: athlete.team, from: now.slice(0, 10) });
  // Le regole e le scelte dello staff partita per partita; se la tabella delle impostazioni manca valgono quelle di serie.
  let policy: ReportingPolicy = DEFAULT_REPORTING_POLICY;
  try {
    const [rules, settings] = await Promise.all([repo.getReportingRules(), repo.listMatchReporting(upcoming.map((match) => match.id))]);
    policy = { rules, matches: new Map(settings.map((setting) => [setting.matchId, setting] as const)) };
  } catch (error) {
    if (!isAppSettingsMissing(error)) throw error;
  }
  const options = matchesForAthlete(athlete, upcoming, now, 12, policy);
  // Senza la tabella delle assenze (null) o quella delle impostazioni, dove sta il certificato (undefined), quella parte si spiega da
  // sola e il resto funziona; senza entrambe, niente pagina d'errore: si dice che non è pronto.
  const [answers, certificate] = await Promise.all([
    repo.listMatchAvailability({ athleteId: athlete.id, matchIds: options.map(({ match }) => match.id) }).catch((error: unknown) => {
      if (!isAvailabilityTableMissing(error)) throw error;
      return null;
    }),
    repo.getMedicalCertificate(athlete.id).catch((error: unknown): MedicalCertificate | null | undefined => {
      if (!isAppSettingsMissing(error)) throw error;
      return undefined;
    }),
  ]);
  if (answers === null && certificate === undefined) return <NotReady />;
  const absenceByMatch = new Map((answers ?? []).filter(isAbsence).map((row) => [row.matchId, row] as const));
  // Chi dello staff ha scritto qualcosa si vede con il suo nome («Segnata da Gaga»): solo il nome, niente altro dell'account.
  const staffNames =
    [...absenceByMatch.values()].some((row) => row.updatedBy) || certificate?.updatedBy
      ? staffNamesById(await repo.listStaff())
      : new Map<string, string>();
  const today = todayIso();
  const status = certificate === undefined ? null : certificateStatus(certificate, today);
  const certificateCard =
    status && certificate !== undefined ? (
      <FamilyCertificateCard
        label={statusLabel(status)}
        issuedOn={certificate?.issuedOn ?? null}
        validUntil={certificate?.validUntil ?? null}
        author={
          certificate
            ? `Visita del ${dayLabel(certificate.issuedOn)} · date scritte ${
                certificate.by === "parent" ? "da voi" : byPhrase(certificate.updatedBy ? staffNames.get(certificate.updatedBy) : null)
              } · ${answerWhen(certificate.updatedAt)}`
            : null
        }
        today={today}
        save={saveFamilyCertificateAction.bind(null, codice)}
      />
    ) : null;

  // Solo quello che serve a mostrare le partite: mai chi è convocata né altri dati.
  const items: FamilyMatchItem[] = options.map(({ match, open, state, setting }) => {
    const row = absenceByMatch.get(match.id);
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
      deadline: state.kind === "open" ? deadlineLabel(state.deadline) : null,
      closedNote: parentClosedNote(state, policy.rules),
      message: setting?.message ?? null,
      messageFrom: setting?.message ? fromLabel(setting.messageBy) : null,
      absence: row
        ? {
            reason: row.reason,
            note: row.note,
            by: row.answeredBy,
            byName: row.updatedBy ? (staffNames.get(row.updatedBy) ?? null) : null,
            when: answerWhen(row.updatedAt),
          }
        : null,
    };
  });

  return (
    <FamilyShell>
      <p className="eyebrow">{certificateCard ? "Assenze e certificato medico" : "Assenze alle partite"}</p>
      <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl" data-family-athlete>
        {athlete.fullName}
        <CategoryTag category={athlete.category} size="md" long />
      </h1>

      {/* Sempre qui in cima, piccolo quando è in regola: salvando le date non si sposta (chi arriva dal messaggio lo trova subito). */}
      {certificateCard && <div className="mt-6">{certificateCard}</div>}

      <section className="mt-8" data-family-absences>
        <h2 className="font-display text-lg font-bold text-foreground">Assenze alle partite</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Se non potrà esserci a una partita tocca <b className="font-semibold text-foreground/80">Non ci sarà</b>: l&apos;allenatore lo vede subito. Se ci
          sarà non devi fare niente. Puoi segnalarlo (o annullarlo) fino alla scadenza scritta sotto ogni partita; dopo, scrivi all&apos;allenatore.
        </p>

        {policy.rules.paused && (
          <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-semibold text-foreground" data-family-paused>
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            Le segnalazioni sono sospese: per avvisare, scrivi all&apos;allenatore.
          </p>
        )}
        {policy.rules.notice && (
          <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-primary-soft/70 px-4 py-3 text-sm text-foreground" data-family-notice>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              <b className="font-semibold">{fromLabel(policy.rules.noticeBy)}:</b> {policy.rules.notice}
            </span>
          </p>
        )}

        <div className="mt-6">
          {answers ? (
            <AvailabilityPanel token={codice} items={items} />
          ) : (
            <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground" data-family-absences-not-ready>
              Le assenze alle partite non sono ancora attive: per avvisare, sentite l&apos;allenatore.
            </p>
          )}
        </div>
      </section>

      <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
        Questo link è personale: non condividerlo con altri. Se lo perdi o pensi che sia finito in mani sbagliate, dillo all&apos;allenatore: ne prepara uno
        nuovo e questo smette di funzionare.
      </p>
    </FamilyShell>
  );
}
