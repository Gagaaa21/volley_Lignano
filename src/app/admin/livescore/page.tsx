import type { Metadata } from "next";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { todayIso } from "@/lib/today";
import { LiveScoreClient, type LiveScoreCalendarMatch } from "./LiveScoreClient";

export const metadata: Metadata = {
  title: "Live score",
};

export default async function LiveScorePage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const today = todayIso();
  const [athletes, matches] = await Promise.all([
    repo.listAthletes({ team }),
    repo.listMatches({ team, from: today, to: today }),
  ]);
  const athleteNames = athletes.filter((a) => a.isActive).map((a) => a.fullName);
  // Le partite di oggi, da collegare al tabellone in Partita: precompilano
  // l'avversaria e danno la categoria alla diretta pubblica.
  const todayMatches: LiveScoreCalendarMatch[] = matches.map((m) => ({
    id: m.id,
    time: m.matchDate.slice(11, 16),
    category: m.category,
    opponent: m.opponent,
    isTournament: m.isTournament,
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <LiveScoreClient athleteNames={athleteNames} team={team} todayMatches={todayMatches} />
    </div>
  );
}
