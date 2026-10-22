import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { seatsLeft, summarizeTrip } from "@/lib/trips/rules";
import { VEHICLE_KIND_LABELS, type MatchTripData } from "@/lib/trips/types";
import type { Athlete, Match } from "@/lib/types";
import { PdfReport, type PdfCellInput, type PdfColumn } from "@/lib/pdf/report";
import { categoryTone } from "@/lib/pdf/matchesPdf";

/**
 * Il riepilogo di una trasferta da mandare alle famiglie: la partita e il ritrovo, i mezzi con chi guida, la partenza e chi
 * viaggia con chi, e le convocate che non hanno ancora un passaggio. Non contiene mai i numeri dei genitori né le note
 * riservate; i numeri degli autisti solo se chi lo prepara li vuole (`includeDriverNumbers`).
 *
 * `tripPdfContent` decide cosa finisce nel foglio (testi semplici, senza impaginazione): è la parte che si prova, perché
 * quello che non ci passa non può comparire nel PDF.
 */

export interface TripPdfInput {
  match: Match;
  data: MatchTripData;
  athletes: readonly Athlete[];
  includeDriverNumbers: boolean;
  generatedAt?: Date;
}

export interface TripPdfVehicle {
  driver: string;
  /** Il tipo di mezzo e, se richiesto, il numero dell'autista. */
  sub: string;
  departure: string | null;
  passengers: string[];
  taken: number;
  seats: number;
  full: boolean;
  free: number;
}

export interface TripPdfContent {
  when: string;
  meeting: string;
  totals: string;
  vehicles: TripPdfVehicle[];
  unplaced: string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function tripPdfTitle(match: Match): string {
  return `Trasferta ${matchTitle(match)}`;
}

export function tripPdfContent(input: Omit<TripPdfInput, "generatedAt">): TripPdfContent {
  const { match, data, includeDriverNumbers } = input;
  const nameById = new Map(input.athletes.map((athlete) => [athlete.id, athlete.fullName] as const));
  const nameOf = (athleteId: string) => nameById.get(athleteId) ?? null;
  const summary = summarizeTrip(data, match.calledUpAthleteIds);
  const meeting = [match.meetingTime ? `ore ${match.meetingTime}` : null, match.meetingLocation].filter(Boolean).join(" · ");
  return {
    when: `${formatDateLong(match.matchDate.slice(0, 10))} · ore ${match.matchDate.slice(11, 16)} · ${match.location}`,
    meeting: meeting ? `Ritrovo: ${meeting}` : "Ritrovo: all'orario della partita",
    totals: `${plural(summary.vehicles, "mezzo", "mezzi")} · ${plural(summary.seats, "posto", "posti")}`,
    vehicles: data.vehicles.map((vehicle) => ({
      driver: vehicle.driverName,
      sub: [VEHICLE_KIND_LABELS[vehicle.kind], includeDriverNumbers && vehicle.driverPhone ? vehicle.driverPhone : null]
        .filter(Boolean)
        .join(" · "),
      departure:
        [vehicle.departureTime ? `ore ${vehicle.departureTime}` : null, vehicle.departurePlace].filter(Boolean).join("\n") || null,
      passengers: vehicle.athleteIds.map(nameOf).filter((name): name is string => name !== null),
      taken: vehicle.athleteIds.length,
      seats: vehicle.seats,
      full: seatsLeft(vehicle) === 0,
      free: seatsLeft(vehicle),
    })),
    unplaced: summary.unplaced.map(nameOf).filter((name): name is string => name !== null),
  };
}

export async function buildTripPdf(input: TripPdfInput): Promise<Uint8Array> {
  const { match } = input;
  const content = tripPdfContent(input);
  const categoryLabel = match.category ? CATEGORY_LABELS[match.category] : MATCH_NO_CATEGORY_LABEL;

  const report = await PdfReport.create({
    title: "Trasferta",
    subtitle: `${categoryLabel} · ${matchTitle(match)} · ${formatDateLong(match.matchDate.slice(0, 10))}`,
    documentTitle: tripPdfTitle(match),
    footerLabel: "Volley Lignano · trasferta",
    generatedAt: input.generatedAt,
    tag: match.category ? { text: categoryLabel.toUpperCase(), tone: categoryTone(match.category) ?? "primary" } : undefined,
  });

  report.heading("La partita");
  report.text(content.when, { size: 10.5, bold: true, tone: "default", gapAfter: 3 });
  report.text(content.meeting, { size: 10, tone: "default", gapAfter: 10 });

  report.heading("Mezzi", content.totals);
  const columns: PdfColumn[] = [
    { header: "Mezzo e autista", weight: 2.4 },
    { header: "Partenza", weight: 1.7 },
    { header: "Chi viaggia", weight: 3 },
    { header: "Posti", weight: 0.9, align: "right" },
  ];
  const rows: PdfCellInput[][] = content.vehicles.map((vehicle) => [
    { text: vehicle.driver, bold: true, sub: vehicle.sub },
    vehicle.departure ?? { text: "Dal ritrovo", tone: "muted" },
    vehicle.passengers.length > 0 ? vehicle.passengers.join("\n") : { text: "Nessuna atleta", tone: "muted" },
    {
      text: `${vehicle.taken}/${vehicle.seats}`,
      tone: vehicle.full ? "success" : "default",
      sub: vehicle.full ? "pieno" : plural(vehicle.free, "libero", "liberi"),
    },
  ]);
  report.table(columns, rows, { emptyText: "Nessun mezzo ancora." });

  if (content.unplaced.length > 0) {
    report.spacer(8);
    report.heading("Ancora senza passaggio", plural(content.unplaced.length, "atleta", "atlete"));
    report.text(content.unplaced.join(", "), { size: 10, tone: "default" });
  }

  return report.finish();
}
