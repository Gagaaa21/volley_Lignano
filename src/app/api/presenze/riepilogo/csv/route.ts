import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { summarizeAttendance } from "@/lib/attendanceSummary";
import { buildCsv } from "@/lib/csv";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";
import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";
import { todayIso } from "@/lib/today";

/** Percentuale di presenza per atleta, stessa logica di
 * presenze/atleta/[id]/page.tsx: per il Minivolley un'assenza non ha mai
 * una voce nel registro (solo le presenze vengono salvate), quindi il
 * totale è il numero di sedute registrate per la squadra, non la somma
 * degli status nel record dell'atleta. */
export async function GET() {
  const session = await requireStaffPage("presenze");
  const team = await resolveActiveTeam(session);
  const isMini = team === "minivolley";
  const repo = await getActiveRepo();
  const [athletes, allSessions] = await Promise.all([
    repo.listAthletes({ team }),
    repo.listAttendanceSessions({ team }),
  ]);

  const todayStr = todayIso();
  const sessions = allSessions.filter((s) => isMinivolleyDateRelevant(team, s.sessionDate, todayStr));

  const rows = summarizeAttendance(athletes, sessions, isMini).map(({ athlete, total, present, excused, unexcused, pct }) => [
    athlete.fullName,
    athlete.category ? CATEGORY_LABELS[athlete.category] : "",
    athlete.group ? MINIVOLLEY_GROUP_LABELS[athlete.group] : "",
    String(total),
    String(present),
    pct === null ? "" : `${pct}%`,
    isMini ? "" : String(excused),
    isMini ? "" : String(unexcused),
  ]);

  const csv = buildCsv(
    ["Nome e cognome", "Categoria", "Gruppo", "Sedute totali", "Presenze", "% Presenza", "Giustificate", "Non giustificate"],
    rows,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="riepilogo-presenze-${team}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
