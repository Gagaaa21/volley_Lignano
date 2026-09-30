import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { buildCsv } from "@/lib/csv";
import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";

export async function GET() {
  const session = await requireStaffPage("presenze");
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const athletes = await repo.listAthletes({ team });

  const rows = athletes
    .slice()
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((a) => [
      a.fullName,
      a.category ? CATEGORY_LABELS[a.category] : "",
      a.group ? MINIVOLLEY_GROUP_LABELS[a.group] : "",
      a.isActive ? "Sì" : "No",
      a.notes ?? "",
    ]);

  const csv = buildCsv(["Nome e cognome", "Categoria", "Gruppo", "Attiva", "Note"], rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atlete-${team}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
