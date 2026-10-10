import { summarizeAttendance } from "@/lib/attendanceSummary";
import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";
import type { Athlete, AttendanceSession, TrainingTeam } from "@/lib/types";
import { PdfReport, type PdfCellInput, type PdfColumn } from "@/lib/pdf/report";

/**
 * Riepilogo presenze da stampare: una riga per atleta con sedute, presenze e
 * percentuale. Per U14/U15 anche le assenze giustificate e non giustificate;
 * per il Minivolley (dove si segnano solo le presenze) solo i totali.
 * `sessions` è già filtrato per le sedute che contano.
 */
export async function buildAttendancePdf(input: {
  team: TrainingTeam;
  athletes: Athlete[];
  sessions: AttendanceSession[];
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const { team, sessions } = input;
  const isMini = team === "minivolley";

  // Un'atleta non più attiva resta solo se ha delle presenze da mostrare.
  const summary = summarizeAttendance(input.athletes, sessions, isMini).filter(
    (row) => row.athlete.isActive || row.total > 0,
  );

  const presentTotal = summary.reduce((sum, row) => sum + row.present, 0);
  const sessionsTotal = summary.reduce((sum, row) => sum + row.total, 0);
  const average = sessionsTotal > 0 ? Math.round((presentTotal / sessionsTotal) * 100) : null;

  const scope = isMini ? "Minivolley" : "Under 14 e Under 15";
  const report = await PdfReport.create({
    title: "Riepilogo presenze",
    subtitle: `${scope} · ${sessions.length} ${sessions.length === 1 ? "allenamento registrato" : "allenamenti registrati"}`,
    footerLabel: "Volley Lignano · riservato allo staff",
    theme: isMini ? "minivolley" : "u14u15",
    generatedAt: input.generatedAt,
  });

  const columns: PdfColumn[] = [
    { header: "Atleta", weight: 3 },
    { header: isMini ? "Gruppo" : "Categoria", weight: 1.4 },
    { header: "Allenamenti", weight: 1.45, align: "right" },
    { header: "Presenze", weight: 1, align: "right" },
    { header: "% presenza", weight: 1.1, align: "right" },
    ...(isMini
      ? []
      : ([
          { header: "Assenze giustificate", weight: 1.3, align: "right" },
          { header: "Assenze non giustificate", weight: 1.3, align: "right" },
        ] as PdfColumn[])),
  ];

  const rows: PdfCellInput[][] = summary.map(({ athlete, total, present, excused, unexcused, pct }) => [
    { text: athlete.fullName, bold: true, sub: athlete.isActive ? undefined : "non più attiva" },
    athlete.category ? CATEGORY_LABELS[athlete.category] : athlete.group ? MINIVOLLEY_GROUP_LABELS[athlete.group] : "—",
    String(total),
    String(present),
    { text: pct === null ? "—" : `${pct}%`, bold: pct !== null, tone: pct === null ? "muted" : "default" },
    ...(isMini ? [] : [String(excused), String(unexcused)]),
  ]);

  report.heading("Presenze per atleta", `${summary.length} ${summary.length === 1 ? "atleta" : "atlete"}`);
  report.table(columns, rows, { emptyText: "Nessuna atleta in anagrafica." });

  if (average !== null) {
    report.text(`Presenza media della squadra: ${average}%.`, { tone: "default", bold: true, gapAfter: 4 });
  }
  report.text(
    isMini
      ? "Per il Minivolley si segnano solo le presenze: la percentuale è sul totale degli allenamenti registrati."
      : "La percentuale è calcolata sugli allenamenti in cui l'atleta era nel registro (presente, assente giustificata o non giustificata).",
    { size: 8 },
  );

  return report.finish();
}
