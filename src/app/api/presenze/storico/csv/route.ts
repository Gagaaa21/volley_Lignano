import { format } from "date-fns";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { buildCsv } from "@/lib/csv";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";

const STATUS_LABEL: Record<string, string> = {
  present: "Presente",
  excused: "Assenza giustificata",
  unexcused: "Assenza non giustificata",
};

export async function GET() {
  const session = await requireStaffPage("presenze");
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [allSessions, athletes] = await Promise.all([
    repo.listAttendanceSessions({ team }),
    repo.listAthletes({ team }),
  ]);
  const sessions = allSessions
    .filter((s) => isMinivolleyDateRelevant(team, s.sessionDate, todayStr))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const nameById = new Map(athletes.map((a) => [a.id, a.fullName] as const));

  const rows: string[][] = [];
  for (const s of sessions) {
    for (const [athleteId, status] of Object.entries(s.records)) {
      rows.push([
        s.sessionDate,
        s.title,
        s.location,
        nameById.get(athleteId) ?? "Atleta rimossa",
        STATUS_LABEL[status] ?? status,
      ]);
    }
  }

  const csv = buildCsv(["Data", "Titolo", "Luogo", "Atleta", "Stato"], rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="presenze-${team}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
