import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { buildCsv } from "@/lib/csv";
import { CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import type { Match } from "@/lib/types";

function matchTypeLabel(match: Match): string {
  if (match.isTournament) return "Torneo";
  if (match.isFriendly) return "Amichevole";
  return "Campionato";
}

function resultLabel(match: Match): string {
  if (match.resultSetsWon === null || match.resultSetsLost === null) return "";
  return match.resultSetsWon > match.resultSetsLost
    ? `Vinta ${match.resultSetsWon}-${match.resultSetsLost}`
    : `Persa ${match.resultSetsWon}-${match.resultSetsLost}`;
}

function setsLabel(match: Match): string {
  if (match.isTournament) {
    return (match.tournamentGames ?? [])
      .filter((g) => g.setScores.length > 0)
      .map((g) => `vs ${g.opponent}: ${g.setScores.map((s) => `${s.us}-${s.them}`).join(", ")}`)
      .join(" · ");
  }
  return (match.setScores ?? []).map((s) => `${s.us}-${s.them}`).join(", ");
}

export async function GET() {
  const session = await requireStaffPage("partite");
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const matches = await repo.listMatches({ team });

  const rows = matches
    .slice()
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .map((m) => [
      m.matchDate.slice(0, 10),
      m.matchDate.slice(11, 16),
      m.category ? CATEGORY_LABELS[m.category] : MATCH_NO_CATEGORY_LABEL,
      m.opponent,
      matchTypeLabel(m),
      m.isHome ? "Casa" : "Trasferta",
      resultLabel(m),
      setsLabel(m),
      m.location,
    ]);

  const csv = buildCsv(
    ["Data", "Ora", "Categoria", "Avversario", "Tipo", "Casa/Trasferta", "Risultato", "Parziali", "Luogo"],
    rows,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="partite-${team}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
