import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/guard";
import { boardHref } from "@/lib/scout/boardLink";

/**
 * /tabellone senza chiave: per lo staff collegato, una scorciatoia al link del tabellone (vedi boardLink.ts); per gli altri il
 * login. `?prova=1` resta.
 */
export default async function TabelloneShortcut({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("scout");
  const { prova } = await searchParams;
  redirect(`${boardHref()}${prova === "1" ? "?prova=1" : ""}`);
}
