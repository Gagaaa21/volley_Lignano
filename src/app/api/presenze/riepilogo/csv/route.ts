import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { buildCsv } from "@/lib/csv";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";
import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";

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

  const todayStr = new Date().toISOString().slice(0, 10);
  const sessions = allSessions.filter((s) => isMinivolleyDateRelevant(team, s.sessionDate, todayStr));

  const rows = athletes
    .slice()
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((athlete) => {
      let total: number;
      let present: number;
      let excused: number;
      let unexcused: number;
      if (isMini) {
        total = sessions.length;
        present = sessions.filter((s) => athlete.id in s.records).length;
        excused = 0;
        unexcused = 0;
      } else {
        const statuses = sessions.filter((s) => athlete.id in s.records).map((s) => s.records[athlete.id]);
        total = statuses.length;
        present = statuses.filter((s) => s === "present").length;
        excused = statuses.filter((s) => s === "excused").length;
        unexcused = statuses.filter((s) => s === "unexcused").length;
      }
      const presencePct = total > 0 ? Math.round((present / total) * 100) : null;

      return [
        athlete.fullName,
        athlete.category ? CATEGORY_LABELS[athlete.category] : "",
        athlete.group ? MINIVOLLEY_GROUP_LABELS[athlete.group] : "",
        String(total),
        String(present),
        presencePct === null ? "" : `${presencePct}%`,
        isMini ? "" : String(excused),
        isMini ? "" : String(unexcused),
      ];
    });

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
