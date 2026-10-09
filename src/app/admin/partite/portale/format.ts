import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Match } from "@/lib/types";

/** «sab 18 ott · ore 11:00» */
export function whenLabel(iso: string): string {
  return `${format(parseISO(iso.slice(0, 10)), "EEE d MMM", { locale: it })} · ore ${iso.slice(11, 16)}`;
}

export function sideLabel(isHome: boolean): string {
  return isHome ? "in casa" : "in trasferta";
}

/** Parziali dal nostro lato: «25-16 · 25-15 · 25-10». */
export function setsLine(sets: { us: number; them: number }[] | null): string | null {
  return sets && sets.length > 0 ? sets.map((set) => `${set.us}-${set.them}`).join(" · ") : null;
}

/** Una partita del sito in una riga: «vs Degano · in casa · sab 18 ott · ore 11:00». */
export function siteMatchLabel(match: Match): string {
  return `vs ${match.opponent} · ${sideLabel(match.isHome)} · ${whenLabel(match.matchDate)}`;
}

/** Risultato visto da noi, «3–1 per noi» / «1–3 per loro». */
export function resultLabel(us: number, them: number): string {
  return `${us}–${them} ${us > them ? "per noi" : us < them ? "per loro" : ""}`.trim();
}
