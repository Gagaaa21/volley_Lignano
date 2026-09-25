import type { Metadata } from "next";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LiveScoreClient } from "./LiveScoreClient";

export const metadata: Metadata = {
  title: "Live score",
};

export default async function LiveScorePage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  // Il Minivolley non ha anagrafica atlete (vedi Presenze): niente
  // registro da cui pescare, i campi restano a testo libero.
  const athletes = team === "minivolley" ? [] : await repo.listAthletes({ team });
  const athleteNames = athletes.filter((a) => a.isActive).map((a) => a.fullName);

  return (
    <div className="mx-auto max-w-6xl">
      <LiveScoreClient athleteNames={athleteNames} />
    </div>
  );
}
