"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { notifyCalendarChange } from "@/lib/push";
import { parseClockTime } from "@/lib/clockTime";
import { matchToInput } from "@/lib/matchInput";
import {
  callUpsNotice,
  deletedMatchNotice,
  matchChangeNotice,
  matchNoticeTag,
  matchNoticeUrl,
  newMatchNotice,
  resultNotice,
  type MatchNotice,
} from "@/lib/matchNotices";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import { clearPublicScore } from "@/lib/scout/publicSnapshot";
import { parseSetScoresFromFormData, parseTournamentGamesJson } from "@/lib/setScores";
import type { Match, MatchInput, MatchLineupInput } from "@/lib/types";
import { todayIso } from "@/lib/today";

const schema = z
  .object({
    team: z.enum(["u14u15", "minivolley"]),
    // Solo per la squadra u14u15: il Minivolley non ha la distinzione U14/U15.
    category: z.union([z.enum(["U14", "U15"]), z.literal("")]).optional(),
    opponent: z.string().min(1, "Inserisci il nome della squadra avversaria."),
    isHome: z.boolean(),
    isFriendly: z.boolean(),
    isTournament: z.boolean(),
    location: z.string().min(1, "Inserisci il luogo della partita."),
    matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Inserisci data e ora della partita."),
    // Facoltativa: vuota = nessuna ora di ritrovo (si toglie così). Si legge anche scritta a mano (1730, 17.30, 17:30:00).
    meetingTime: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const parsed = parseClockTime(v);
        if (!parsed.ok) {
          ctx.addIssue({ code: "custom", message: "L'ora di ritrovo non è valida: scrivila così, 17:30." });
          return z.NEVER;
        }
        return parsed.value;
      }),
    meetingLocation: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.team !== "u14u15" || data.category === "U14" || data.category === "U15", {
    message: "Seleziona una categoria.",
    path: ["category"],
  });

/** Valori grezzi così come inseriti, riportati indietro insieme a un errore (di validazione o di salvataggio): React svuota
 * da solo i campi di un modulo dopo ogni invio, e senza questo un errore farebbe perdere tutto quello che si era scritto
 * (e a chi stava cambiando un orario farebbe tornare quello vecchio, come se il cambio non avesse funzionato). */
export interface MatchFormValues {
  category: string;
  opponent: string;
  isHome: boolean;
  isFriendly: boolean;
  isTournament: boolean;
  location: string;
  matchDate: string;
  meetingTime: string;
  meetingLocation: string;
  notes: string;
  notify: boolean;
}

export interface MatchFormState {
  error?: string;
  values?: MatchFormValues;
}

function readRawValues(formData: FormData): MatchFormValues {
  return {
    category: formData.get("category")?.toString() ?? "",
    opponent: formData.get("opponent")?.toString() ?? "",
    isHome: formData.get("isHome") !== "away",
    isFriendly: formData.get("isFriendly") === "on",
    isTournament: formData.get("isTournament") === "on",
    location: formData.get("location")?.toString() ?? "",
    matchDate: formData.get("matchDate")?.toString() ?? "",
    meetingTime: formData.get("meetingTime")?.toString() ?? "",
    meetingLocation: formData.get("meetingLocation")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    notify: formData.get("notify") === "on",
  };
}

/** Manda l'avviso di una partita a chi segue il calendario della sua squadra: porta al mese giusto e sostituisce sul telefono
 * l'avviso precedente sulla stessa partita. */
async function sendMatchNotice(notice: MatchNotice | null, match: Pick<Match, "team" | "category" | "matchDate">, matchId?: string) {
  if (!notice) return;
  await notifyCalendarChange({ ...notice, url: matchNoticeUrl(match), tag: matchId ? matchNoticeTag(matchId) : undefined }, match.team);
}

function parseMatchForm(formData: FormData) {
  return schema.safeParse({
    team: formData.get("team")?.toString() === "minivolley" ? "minivolley" : "u14u15",
    category: formData.get("category")?.toString() ?? "",
    opponent: formData.get("opponent")?.toString().trim() ?? "",
    isHome: formData.get("isHome") === "home",
    isFriendly: formData.get("isFriendly") === "on",
    isTournament: formData.get("isTournament") === "on",
    location: formData.get("location")?.toString().trim() ?? "",
    matchDate: formData.get("matchDate")?.toString() ?? "",
    meetingTime: formData.get("meetingTime")?.toString() ?? "",
    meetingLocation: formData.get("meetingLocation")?.toString().trim() || undefined,
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
}

export async function saveMatchAction(
  _prevState: MatchFormState,
  formData: FormData,
): Promise<MatchFormState> {
  const session = await requireStaffPage("partite");
  const values = readRawValues(formData);
  const parsed = parseMatchForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi.", values };
  }

  const id = formData.get("id")?.toString();
  const notify = formData.get("notify") === "on";

  // Un errore qui (es. Supabase lento/irraggiungibile) non deve far perdere
  // quanto digitato: si torna al form con un messaggio invece di lasciar
  // risalire l'eccezione (che smonterebbe il form senza un error.tsx
  // dedicato).
  try {
    const repo = await getActiveRepo();
    // Qui si cambiano solo i dettagli: convocazioni (finestra «Convocazioni e formazioni») e risultato (riquadro «Risultato»
    // della partita) restano come sono. La squadra di una partita esistente non cambia mai in modifica (il campo "team" nel
    // form è nascosto e riflette quella già salvata).
    const existing = id ? await repo.getMatch(id) : null;
    if (id && !existing) return { error: "La partita non c'è più: forse è stata eliminata.", values };
    const team = existing?.team ?? parsed.data.team;
    const input: MatchInput = {
      team,
      category: team === "u14u15" ? (parsed.data.category as "U14" | "U15") : null,
      opponent: parsed.data.opponent,
      isHome: parsed.data.isHome,
      isFriendly: parsed.data.isFriendly,
      isTournament: parsed.data.isTournament,
      location: parsed.data.location,
      matchDate: parsed.data.matchDate,
      meetingTime: parsed.data.meetingTime,
      meetingLocation: parsed.data.meetingLocation ?? null,
      notes: parsed.data.notes ?? null,
      calledUpAthleteIds: existing?.calledUpAthleteIds ?? [],
      // Un torneo e una partita normale tengono il risultato in campi diversi: se la partita cambia tipo, quello di prima
      // non vale più.
      setScores: existing && existing.isTournament === parsed.data.isTournament ? existing.setScores : null,
      resultSetsWon: existing && existing.isTournament === parsed.data.isTournament ? existing.resultSetsWon : null,
      resultSetsLost: existing && existing.isTournament === parsed.data.isTournament ? existing.resultSetsLost : null,
      tournamentGames: existing && existing.isTournament === parsed.data.isTournament ? existing.tournamentGames : null,
    };

    if (existing && id) {
      await repo.updateMatch(id, input);
      // L'avviso dice che cosa è cambiato (orario, luogo, ritrovo…); se non è cambiato niente che interessi, non parte.
      if (notify) await sendMatchNotice(matchChangeNotice(existing, input), input, id);
    } else {
      const created = await repo.createMatch(input, session.sub);
      if (notify) await sendMatchNotice(newMatchNotice(input), input, created.id);
    }

    revalidatePath("/admin/partite");
    // Solo il sito pubblico della squadra toccata: i due siti sono
    // indipendenti.
    revalidatePath(team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error("[saveMatchAction]", err);
    return { error: "Non è stato possibile salvare la partita. Riprova.", values };
  }

  // Una partita nuova torna all'elenco; una modificata alla sua scheda.
  redirect(id ? `/admin/partite/${id}` : "/admin/partite");
}

export interface MatchResultFormState {
  error?: string;
  message?: string;
  /** Quello che si era scritto, riportato indietro con un errore (React svuoterebbe i campi). */
  values?: { setUs: string[]; setThem: string[]; tournamentGames: string };
}

/** Il risultato di una partita giocata, dal suo riquadro «Risultato»: parziali set per set (o, per un torneo, una partita per
 * avversaria). Si salva da solo, senza toccare i dettagli, e avvisa con «Vinta 3-1» e i parziali. */
export async function saveMatchResultAction(_prevState: MatchResultFormState, formData: FormData): Promise<MatchResultFormState> {
  await requireStaffPage("partite");
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Partita non valida." };
  const values = {
    setUs: formData.getAll("setUs").map((v) => v.toString()),
    setThem: formData.getAll("setThem").map((v) => v.toString()),
    tournamentGames: formData.get("tournamentGames")?.toString() ?? "[]",
  };
  const notify = formData.get("notify") === "on";

  try {
    const repo = await getActiveRepo();
    const match = await repo.getMatch(id);
    if (!match) return { error: "La partita non c'è più: forse è stata eliminata." };

    // Per un torneo il risultato non è un unico setScores ma una partita per ogni avversaria affrontata (tournamentGames):
    // i due campi sono a esclusione reciproca, mai valorizzati entrambi.
    const result = match.isTournament ? { setScores: null, resultSetsWon: null, resultSetsLost: null } : parseSetScoresFromFormData(formData);
    if ("error" in result && result.error) return { error: result.error, values };
    const tournament = match.isTournament
      ? parseTournamentGamesJson(values.tournamentGames, { requireCompleteScore: false })
      : { tournamentGames: null };
    if ("error" in tournament && tournament.error) return { error: tournament.error, values };

    const hasResult = result.resultSetsWon !== null || (tournament.tournamentGames?.some((g) => g.setScores.length > 0) ?? false);
    // Solo sulla data (non sull'ora, per non sbagliare col fuso tra telefono e server): un risultato si scrive a partita giocata.
    if (hasResult && match.matchDate.slice(0, 10) > todayIso()) {
      return { error: "Puoi inserire il risultato solo dopo che la partita è stata giocata.", values };
    }

    const next = {
      setScores: result.setScores,
      resultSetsWon: result.resultSetsWon,
      resultSetsLost: result.resultSetsLost,
      tournamentGames: tournament.tournamentGames,
    };
    await repo.updateMatch(id, { ...matchToInput(match), ...next });
    if (notify) await sendMatchNotice(resultNotice(match, match, next), match, id);

    revalidatePath("/admin/partite");
    revalidatePath(`/admin/partite/${id}`);
    revalidatePath("/admin");
    revalidatePath(match.team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
    return { message: hasResult ? "Risultato salvato." : "Risultato tolto." };
  } catch (err) {
    console.error("[saveMatchResultAction]", err);
    return { error: "Non è stato possibile salvare il risultato. Riprova.", values };
  }
}

/** Pagine da cui si può eliminare una partita e su cui si torna dopo (il resto torna all'elenco). */
const DELETE_RETURN_PATHS = new Set(["/admin/partite", "/admin/partite/portale"]);

export async function deleteMatchAction(formData: FormData): Promise<void> {
  await requireStaffPage("partite");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const requestedReturn = formData.get("returnTo")?.toString() ?? "";
  const returnTo = DELETE_RETURN_PATHS.has(requestedReturn) ? requestedReturn : "/admin/partite";
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  await repo.deleteMatch(id);
  // Con la partita se ne va anche lo scout: il suo punteggio live non deve restare sul sito.
  await clearPublicScore(repo, id).catch((error: unknown) => console.error("[deleteMatchAction] punteggio live non tolto:", error));
  if (match) await sendMatchNotice(deletedMatchNotice(match), match, match.id);
  revalidatePath("/admin/partite");
  revalidatePath("/admin/partite/portale");
  revalidatePath("/admin");
  revalidatePath(match?.team === "minivolley" ? "/minivolley" : "/");
  updateTag(PUBLIC_CALENDAR_TAG);
  redirect(returnTo);
}

const positionSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const lineupSlotSchema = z.object({
  position: positionSchema,
  athleteId: z.string().nullable(),
  role: z.enum(["S", "OH", "MB", "OP", "L"]).nullable(),
  isCaptain: z.boolean(),
});

const setLineupSchema = z.object({
  slots: z.array(lineupSlotSchema).length(6),
  liberoIds: z.array(z.string().nullable()).length(2),
});

const lineupSchema = z.object({
  sets: z.array(setLineupSchema).length(5),
});

/** Al massimo una capitana per set (tiene solo la prima trovata), nessuna
 * convocata assegnata due volte nello stesso set (posizione + libero) e solo
 * atlete effettivamente convocate. */
function normalizeSets(
  sets: MatchLineupInput["sets"],
  calledUpAthleteIds: string[],
): MatchLineupInput["sets"] {
  const calledUp = new Set(calledUpAthleteIds);
  return sets.map((set) => {
    let captainFound = false;
    const assigned = new Set<string>();

    const slots = set.slots.map((slot) => {
      let next = slot;
      if (next.athleteId && !calledUp.has(next.athleteId)) {
        next = { ...next, athleteId: null, role: null, isCaptain: false };
      }
      if (next.athleteId) {
        if (assigned.has(next.athleteId)) next = { ...next, athleteId: null, role: null, isCaptain: false };
        else assigned.add(next.athleteId);
      }
      if (next.isCaptain) {
        if (captainFound) next = { ...next, isCaptain: false };
        else captainFound = true;
      }
      return next;
    });

    const liberoIds = set.liberoIds.map((athleteId) => {
      if (!athleteId || !calledUp.has(athleteId) || assigned.has(athleteId)) return null;
      assigned.add(athleteId);
      return athleteId;
    });

    return { slots, liberoIds };
  });
}

export interface CallUpsAndLineupFormState {
  error?: string;
  success?: boolean;
}

/** Salva insieme le convocazioni della partita e le formazioni per set,
 * gestite entrambe dalla finestra "Convocazioni e formazioni". */
export async function saveCallUpsAndLineupAction(
  _prevState: CallUpsAndLineupFormState,
  formData: FormData,
): Promise<CallUpsAndLineupFormState> {
  const session = await requireStaffPage("partite");
  const matchId = formData.get("matchId")?.toString();
  if (!matchId) return { error: "Partita non valida." };

  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match) return { error: "Partita non trovata." };

  const calledUpAthleteIds = formData.getAll("calledUpAthleteIds").map((v) => v.toString());
  const notify = formData.get("notify") === "on";

  let rawSets: unknown;
  try {
    rawSets = JSON.parse(formData.get("sets")?.toString() ?? "[]");
  } catch {
    return { error: "Dati non validi." };
  }

  const parsed = lineupSchema.safeParse({ sets: rawSets });
  if (!parsed.success) {
    return { error: "Dati non validi." };
  }

  const input: MatchInput = { ...matchToInput(match), calledUpAthleteIds };
  try {
    await repo.updateMatch(matchId, input);
    await repo.saveMatchLineup(
      matchId,
      { sets: normalizeSets(parsed.data.sets, calledUpAthleteIds) },
      session.sub,
    );
    // Avvisa solo se la lista delle convocate è cambiata (le formazioni restano allo staff).
    if (notify) await sendMatchNotice(callUpsNotice(match, match.calledUpAthleteIds, calledUpAthleteIds), match, matchId);
    revalidatePath(`/admin/partite/${matchId}`);
    // Le convocazioni sono visibili anche sul sito pubblico: invalida la
    // cache del calendario, altrimenti resterebbero non aggiornate fino a
    // 5 minuti (il tempo di validità di getPublicCalendarData). Solo il
    // sito della squadra toccata: i due siti sono indipendenti.
    revalidatePath(match.team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error("[saveCallUpsAndLineupAction]", err);
    return { error: "Non è stato possibile salvare convocazioni e formazioni. Riprova." };
  }
  return { success: true };
}
