import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Car, Clock, MapPin, Phone, Trash2, UserMinus, UserPlus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff, requireStaffPage } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { contactNames } from "@/lib/trips/contacts";
import { isTripTableMissing } from "@/lib/trips/missing";
import { phoneHref } from "@/lib/trips/phone";
import { seatsLeft, summarizeTrip } from "@/lib/trips/rules";
import {
  VEHICLE_KIND_LABELS,
  emptyTripData,
  type AthleteContact,
  type AthleteContacts,
  type MatchTrip,
  type TripVehicle,
} from "@/lib/trips/types";
import type { Athlete } from "@/lib/types";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { ContactLinks } from "@/components/trips/ContactLinks";
import { TripPdfButtons } from "@/components/trips/TripPdfButtons";
import { TripsSetupNeeded } from "@/components/trips/TripsSetupNeeded";
import { VehicleForm } from "@/components/trips/VehicleForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Label, Select, Textarea } from "@/components/ui/Field";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import {
  assignAthleteAction,
  removeVehicleAction,
  saveTripNotesAction,
  unassignAthleteAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Trasferta",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ errore?: string }>;
}) {
  const { matchId } = await params;
  const { errore } = await searchParams;
  const session = await requireStaffPage("trasferte");
  const repo = await getActiveRepo();

  const match = await repo.getMatch(matchId);
  if (!match || match.team !== "u14u15") notFound();

  let trip: MatchTrip | null;
  let rubrica: AthleteContacts[];
  let athletes: Athlete[];
  try {
    [trip, rubrica, athletes] = await Promise.all([
      repo.getMatchTrip(matchId),
      repo.listAthleteContacts(),
      repo.listAthletes({ team: "u14u15" }),
    ]);
  } catch (error) {
    if (!isTripTableMissing(error)) throw error;
    return (
      <div>
        <PageHeader back={{ href: "/admin/trasferte", label: "Trasferte" }} title="Trasferta" />
        <TripsSetupNeeded isDev={session.role === "dev"} />
      </div>
    );
  }

  const data = trip ?? emptyTripData();
  const athleteById = new Map<string, Athlete>(athletes.map((a) => [a.id, a]));
  const contactsByAthlete = new Map<string, AthleteContact[]>(rubrica.map((entry) => [entry.athleteId, entry.contacts]));
  const summary = summarizeTrip(data, match.calledUpAthleteIds);
  const notCalledUp = new Set(summary.notCalledUp);
  const vehiclesWithSeats = data.vehicles.filter((v) => seatsLeft(v) > 0);
  const driverNames = contactNames(rubrica);

  const canOpenMatch = session.role === "dev" || ((await getOwnStaff(session.sub))?.allowedPages.includes("partite") ?? false);
  const nameOf = (athleteId: string) => athleteById.get(athleteId)?.fullName ?? "Atleta non più in elenco";

  const meeting = [match.meetingTime ? `ore ${match.meetingTime}` : null, match.meetingLocation].filter(Boolean).join(" · ");
  const kindLabel = (vehicle: TripVehicle) => VEHICLE_KIND_LABELS[vehicle.kind];

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/trasferte", label: "Trasferte" }}
        eyebrow={match.category ? <CategoryTag category={match.category} size="md" long /> : MATCH_NO_CATEGORY_LABEL}
        title={matchTitle(match)}
        description={`${formatDateLong(match.matchDate.slice(0, 10))} · ${match.matchDate.slice(11, 16)} · ${match.location}`}
        actions={
          <>
            {canOpenMatch && (
              <LinkButton href={`/admin/partite/${match.id}`} variant="outline" data-trip-match-link>
                Apri la partita
              </LinkButton>
            )}
            <TripPdfButtons matchId={match.id} title={`Trasferta ${matchTitle(match)}`} />
          </>
        }
      />

      {errore && (
        <p role="alert" data-trip-error className="mb-5 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {errore}
        </p>
      )}

      <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" data-trip-meeting>
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {meeting ? (
          <>
            <span className="font-semibold text-foreground/80">Ritrovo</span> {meeting}
          </>
        ) : (
          "Ritrovo non indicato: se è diverso dall'orario della partita, scrivilo nella partita."
        )}
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div data-trip-stat="called">
          <StatTile label="Convocate" value={summary.calledUp} tone="primary" />
        </div>
        <div data-trip-stat="placed">
          <StatTile label="Con un passaggio" value={summary.placed} tone="success" />
        </div>
        <div data-trip-stat="unplaced">
          <StatTile label="Senza passaggio" value={summary.unplaced.length} tone={summary.unplaced.length > 0 ? "warning" : "success"} />
        </div>
        <div data-trip-stat="free">
          <StatTile label="Posti liberi" value={summary.seatsFree} tone="gold" />
        </div>
      </div>

      {summary.calledUp === 0 && (
        <p className="mb-8 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" data-trip-no-called-up>
          Per questa partita non ci sono ancora convocate, quindi non c&apos;è nessuno da mettere sui mezzi.{" "}
          {canOpenMatch ? (
            <a href={`/admin/partite/${match.id}`} className="font-semibold underline">
              Scegli le convocate dalla partita
            </a>
          ) : (
            "Chi gestisce le partite può sceglierle."
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div className="min-w-0 space-y-8">
          <section data-tour="section-trasferta-vehicles">
            <SectionHeading title="Mezzi" description={data.vehicles.length === 0 ? "Aggiungi chi guida e quanti posti ha il mezzo." : undefined} />
            {data.vehicles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-10 text-center text-sm text-muted-foreground" data-trip-no-vehicles>
                Nessun mezzo ancora. Aggiungine uno qui accanto: poi potrai dire chi ci sale.
              </div>
            ) : (
              <div className="space-y-4">
                {data.vehicles.map((vehicle) => {
                  const left = seatsLeft(vehicle);
                  const href = vehicle.driverPhone ? phoneHref(vehicle.driverPhone) : null;
                  const departure = [vehicle.departureTime ? `ore ${vehicle.departureTime}` : null, vehicle.departurePlace]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Card key={vehicle.id} data-vehicle={vehicle.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-foreground">
                              <Car className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span data-vehicle-title>
                                {kindLabel(vehicle)} · {vehicle.driverName}
                              </span>
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                              {vehicle.driverPhone &&
                                (href ? (
                                  <a href={href} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" data-vehicle-phone>
                                    <Phone className="h-3 w-3" aria-hidden />
                                    {vehicle.driverPhone}
                                  </a>
                                ) : (
                                  <span data-vehicle-phone>{vehicle.driverPhone}</span>
                                ))}
                              {departure && (
                                <span className="inline-flex items-center gap-1" data-vehicle-departure>
                                  <MapPin className="h-3 w-3" aria-hidden />
                                  Partenza {departure}
                                </span>
                              )}
                            </p>
                            {vehicle.notes && <p className="mt-1 text-[13px] text-muted-foreground">{vehicle.notes}</p>}
                          </div>
                          <Badge tone={left === 0 ? "neutral" : "success"} data-vehicle-seats>
                            {vehicle.athleteIds.length}/{vehicle.seats} posti
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardBody className="space-y-4">
                        {vehicle.athleteIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nessuna atleta su questo mezzo.</p>
                        ) : (
                          <ul className="divide-y divide-border rounded-xl border border-border">
                            {vehicle.athleteIds.map((athleteId) => (
                              <li key={athleteId} className="flex items-start justify-between gap-3 px-3.5 py-2.5" data-passenger={athleteId}>
                                <div className="min-w-0">
                                  <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                                    {nameOf(athleteId)}
                                    {notCalledUp.has(athleteId) && <Badge tone="warning">Non più convocata</Badge>}
                                  </p>
                                  <ContactLinks contacts={contactsByAthlete.get(athleteId) ?? []} />
                                </div>
                                <form action={unassignAthleteAction}>
                                  <input type="hidden" name="matchId" value={match.id} />
                                  <input type="hidden" name="athleteId" value={athleteId} />
                                  <Button type="submit" size="sm" variant="outline" data-unassign={athleteId}>
                                    <UserMinus className="h-3.5 w-3.5" />
                                    Togli
                                  </Button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {/* Salvato un cambio la versione sale e il riquadro si rimonta richiuso, con i valori nuovi. */}
                          <details
                            key={`${vehicle.id}-${trip?.version ?? 0}`}
                            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3"
                            data-vehicle-edit={vehicle.id}
                          >
                            <summary className="cursor-pointer text-sm font-semibold text-foreground">Modifica il mezzo</summary>
                            <div className="mt-4">
                              <VehicleForm
                                matchId={match.id}
                                vehicle={vehicle}
                                driverNames={driverNames}
                                idPrefix={`v-${vehicle.id}`}
                              />
                            </div>
                          </details>
                          <form action={removeVehicleAction}>
                            <input type="hidden" name="matchId" value={match.id} />
                            <input type="hidden" name="vehicleId" value={vehicle.id} />
                            <ConfirmSubmitButton
                              confirmMessage={
                                vehicle.athleteIds.length > 0
                                  ? `Eliminare il mezzo di ${vehicle.driverName}? Le ${vehicle.athleteIds.length} atlete sopra resteranno senza passaggio.`
                                  : `Eliminare il mezzo di ${vehicle.driverName}?`
                              }
                              variant="outline"
                              size="sm"
                              data-vehicle-delete={vehicle.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Elimina il mezzo
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section data-tour="section-trasferta-unplaced">
            <SectionHeading title="Senza passaggio" description="Le convocate che non sono ancora su nessun mezzo." />
            {summary.calledUp === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna convocata.</p>
            ) : summary.unplaced.length === 0 ? (
              <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success" data-trip-all-placed>
                Tutte le convocate hanno un passaggio.
              </p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {summary.unplaced.map((athleteId) => (
                  <form
                    key={athleteId}
                    action={assignAthleteAction}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    data-unplaced={athleteId}
                  >
                    <input type="hidden" name="matchId" value={match.id} />
                    <input type="hidden" name="athleteId" value={athleteId} />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{nameOf(athleteId)}</p>
                      <ContactLinks contacts={contactsByAthlete.get(athleteId) ?? []} />
                    </div>
                    {vehiclesWithSeats.length > 0 ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="min-w-0 sm:w-64">
                          <Label htmlFor={`assign-${athleteId}`} className="sr-only">
                            Mezzo per {nameOf(athleteId)}
                          </Label>
                          <Select id={`assign-${athleteId}`} name="vehicleId" defaultValue="" required>
                            <option value="" disabled>
                              Scegli il mezzo
                            </option>
                            {vehiclesWithSeats.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {kindLabel(vehicle)} di {vehicle.driverName} · {plural(seatsLeft(vehicle), "posto libero", "posti liberi")}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button type="submit" size="sm" data-assign={athleteId}>
                          <UserPlus className="h-3.5 w-3.5" />
                          Metti
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {data.vehicles.length === 0 ? "Aggiungi prima un mezzo." : "Nessun mezzo ha posti liberi: aggiungine uno."}
                      </p>
                    )}
                  </form>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-8">
          <section data-tour="section-trasferta-add">
            <SectionHeading title="Aggiungi un mezzo" />
            <Card>
              <CardBody className="pt-5">
                <VehicleForm
                  key={`new-${trip?.version ?? 0}`}
                  matchId={match.id}
                  driverNames={driverNames}
                  idPrefix="v-new"
                  narrow
                />
              </CardBody>
            </Card>
          </section>

          <section data-tour="section-trasferta-notes">
            <SectionHeading title="Note riservate" description="Pranzo, costi, rientro… restano qui." />
            <form action={saveTripNotesAction} className="space-y-3" data-trip-notes-form>
              <input type="hidden" name="matchId" value={match.id} />
              <Label htmlFor="trip-notes" className="sr-only">
                Note sulla trasferta
              </Label>
              <Textarea id="trip-notes" name="notes" defaultValue={data.notes ?? ""} maxLength={2000} placeholder="Es. pranzo al sacco, rientro verso le 20" />
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="outline" data-trip-notes-save>
                  Salva le note
                </Button>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
