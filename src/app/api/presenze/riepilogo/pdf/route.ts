import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";
import { buildAttendancePdf } from "@/lib/pdf/attendancePdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import { todayIso } from "@/lib/today";

/** Riepilogo presenze in PDF (stesso conteggio del CSV, pronto da stampare). */
export async function GET() {
  const session = await requireStaffPage("presenze");
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const [athletes, allSessions] = await Promise.all([
    repo.listAthletes({ team }),
    repo.listAttendanceSessions({ team }),
  ]);

  const today = todayIso();
  const sessions = allSessions.filter((s) => isMinivolleyDateRelevant(team, s.sessionDate, today));
  const bytes = await buildAttendancePdf({ team, athletes, sessions });

  return pdfResponse(bytes, pdfFilename(`riepilogo presenze ${team}`));
}
