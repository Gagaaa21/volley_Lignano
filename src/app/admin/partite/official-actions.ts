"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getActiveRepo, getRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { CATEGORY_LABELS } from "@/lib/category";
import { computeCalendarImport, matchInputFromOfficial } from "@/lib/federation/calendarImport";
import { notifyCalendarChange } from "@/lib/push";
import { ourSide } from "@/lib/federation/matching";
import { orientResult, sameResult } from "@/lib/federation/proposals";
import { MANUAL_REFRESH_MIN_INTERVAL_MS, refreshFederation } from "@/lib/federation/refresh";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import { validateSetScorePairs } from "@/lib/setScores";
import type { Category, MatchInput } from "@/lib/types";

export interface OfficialResultFormState {
  error?: string;
  message?: string;
}

function parseCategory(value: FormDataEntryValue | null): Category | null {
  return value === "U14" || value === "U15" ? value : null;
}

function text(value: FormDataEntryValue | null): string {
  return value?.toString().trim() ?? "";
}

/** Dopo ogni cambiamento: elenco admin, dashboard e sito pubblico. */
function revalidateAll(matchId?: string) {
  revalidatePath("/admin/partite");
  revalidatePath("/admin");
  if (matchId) revalidatePath(`/admin/partite/${matchId}`);
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
}

/**
 * Conferma di un admin: compila i parziali della partita con il risultato
 * ufficiale e ricorda l'abbinamento. Rilegge tutto dai dati salvati (mai
 * quello che arriva dal browser) e non sovrascrive mai un risultato diverso
 * già inserito a mano, a meno che l'admin non lo chieda esplicitamente
 * («Usa quello ufficiale» invia overwrite=1).
 */
export async function applyOfficialResultAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  const session = await requireStaffPage("partite");
  const category = parseCategory(formData.get("category"));
  const externalId = text(formData.get("externalId"));
  const matchId = text(formData.get("matchId"));
  const overwrite = formData.get("overwrite") === "1";
  if (!category || !externalId || !matchId) return { error: "Dati mancanti: aggiorna la pagina e riprova." };

  try {
    const repo = await getActiveRepo();
    const [sources, snapshots, decisions, match] = await Promise.all([
      repo.listFederationSources(),
      repo.listFederationSnapshots(),
      repo.listFederationDecisions(),
      repo.getMatch(matchId),
    ]);

    const source = sources.find((src) => src.category === category);
    const official = snapshots
      .find((snap) => snap.category === category)
      ?.girone?.matches.find((m) => m.externalId === externalId);
    if (!source || !official) return { error: "La gara non è più nei dati della federazione: aggiorna e riprova." };

    const side = ourSide(official, source.teamAliases);
    const result = side ? orientResult(official, side) : null;
    if (!result) return { error: "Questa gara non ha ancora un risultato." };
    if (!result.sets) return { error: "Il portale non ha ancora pubblicato i parziali di questa gara." };

    if (!match || match.team !== "u14u15" || match.category !== category || match.isFriendly || match.isTournament) {
      return { error: "La partita scelta non è una partita di campionato di questa categoria." };
    }
    const alreadyLinked = decisions.find(
      (d) =>
        d.category === category && d.decision === "linked" && d.matchId === match.id && d.externalId !== externalId,
    );
    if (alreadyLinked) return { error: "Questa partita è già abbinata a un'altra gara ufficiale." };

    const hasResult = match.resultSetsWon !== null && match.resultSetsLost !== null;
    if (hasResult && !sameResult(match, result) && !overwrite) {
      return { error: "Nel sito c'è già un risultato diverso: non lo cambio senza una tua scelta esplicita." };
    }

    // Come per i tornei: non tutte le formule giovanili chiudono a 3 set vinti.
    const parsed = validateSetScorePairs(
      result.sets.map((set) => ({ us: String(set.us), them: String(set.them) })),
      { requireThreeSetWins: false },
    );
    if (parsed.error || !parsed.setScores || parsed.resultSetsWon === null || parsed.resultSetsLost === null) {
      return { error: parsed.error ?? "Parziali ufficiali non validi." };
    }
    // Limite dell'archivio: al massimo 3 set vinti da una squadra.
    if (parsed.resultSetsWon > 3 || parsed.resultSetsLost > 3) {
      return { error: "Risultato con più di 3 set vinti: va inserito a mano dalla scheda della partita." };
    }

    const input: MatchInput = {
      team: match.team,
      category: match.category,
      opponent: match.opponent,
      isHome: match.isHome,
      isFriendly: match.isFriendly,
      isTournament: match.isTournament,
      location: match.location,
      matchDate: match.matchDate,
      meetingTime: match.meetingTime,
      meetingLocation: match.meetingLocation,
      notes: match.notes,
      calledUpAthleteIds: match.calledUpAthleteIds,
      setScores: parsed.setScores,
      resultSetsWon: parsed.resultSetsWon,
      resultSetsLost: parsed.resultSetsLost,
      tournamentGames: match.tournamentGames,
    };
    await repo.updateMatch(match.id, input);
    await repo.setFederationDecision({
      category,
      externalId,
      decision: "linked",
      matchId: match.id,
      decidedBy: session.sub,
    });
    revalidateAll(match.id);
  } catch (error) {
    console.error("[applyOfficialResultAction]", error);
    return { error: "Non è stato possibile salvare il risultato. Riprova." };
  }
  return { message: "Risultato salvato." };
}

/** «Ignora» / «Tieni il mio»: la gara non viene più proposta. */
export async function dismissOfficialResultAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  const session = await requireStaffPage("partite");
  const category = parseCategory(formData.get("category"));
  const externalId = text(formData.get("externalId"));
  if (!category || !externalId) return { error: "Dati mancanti: aggiorna la pagina e riprova." };
  try {
    const repo = await getActiveRepo();
    await repo.setFederationDecision({
      category,
      externalId,
      decision: "dismissed",
      matchId: null,
      decidedBy: session.sub,
    });
    revalidateAll();
  } catch (error) {
    console.error("[dismissOfficialResultAction]", error);
    return { error: "Non è stato possibile ignorare la gara. Riprova." };
  }
  return { message: "Gara ignorata." };
}

/** Rimette tra le proposte una gara ignorata. */
export async function restoreOfficialResultAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  await requireStaffPage("partite");
  const category = parseCategory(formData.get("category"));
  const externalId = text(formData.get("externalId"));
  if (!category || !externalId) return { error: "Dati mancanti: aggiorna la pagina e riprova." };
  try {
    const repo = await getActiveRepo();
    await repo.clearFederationDecision(category, externalId);
    revalidateAll();
  } catch (error) {
    console.error("[restoreOfficialResultAction]", error);
    return { error: "Non è stato possibile ripristinare la gara. Riprova." };
  }
  return { message: "Gara ripristinata." };
}

/** Pulsante «Aggiorna ora»: rilegge subito i gironi dal portale, al massimo
 * una volta ogni due minuti. */
export async function refreshOfficialResultsAction(): Promise<OfficialResultFormState> {
  await requireStaffPage("partite");
  try {
    const outcomes = await refreshFederation(await getRepo(), { minIntervalMs: MANUAL_REFRESH_MIN_INTERVAL_MS });
    revalidateAll();
    // Le categorie senza girone (es. U14 non ancora pubblicata) non contano.
    const active = outcomes.filter((outcome) => outcome.status !== "skipped-no-source");
    const failed = active.find((outcome) => outcome.status === "failed");
    if (failed) return { error: failed.message ?? "Il portale non risponde." };
    if (active.length === 0) return { message: "Nessun girone configurato." };
    if (active.every((outcome) => outcome.status === "skipped-recent")) {
      return { message: "Già aggiornato da pochi istanti." };
    }
    return { message: "Aggiornato." };
  } catch (error) {
    console.error("[refreshOfficialResultsAction]", error);
    return { error: "Non è stato possibile aggiornare. Riprova." };
  }
}

/**
 * «Aggiungi dal calendario ufficiale»: crea nel sito le partite scelte da un
 * admin tra quelle che mancano e le abbina alla gara ufficiale, così i
 * risultati arriveranno poi come proposte già collegate. Ricalcola tutto dai
 * dati salvati (mai da quello che arriva dal browser): una partita già
 * presente non si duplica, anche con due clic o due admin insieme.
 */
export async function importOfficialCalendarAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  const session = await requireStaffPage("partite");
  const category = parseCategory(formData.get("category"));
  const wanted = new Set(formData.getAll("externalId").map((value) => value.toString()));
  const notify = formData.get("notify") === "on";
  if (!category) return { error: "Dati mancanti: aggiorna la pagina e riprova." };
  if (wanted.size === 0) return { error: "Scegli almeno una partita da aggiungere." };

  try {
    const repo = await getActiveRepo();
    const [sources, snapshots, decisions, matches] = await Promise.all([
      repo.listFederationSources(),
      repo.listFederationSnapshots(),
      repo.listFederationDecisions(),
      repo.listMatches({ team: "u14u15" }),
    ]);
    const source = sources.find((src) => src.category === category);
    const girone = snapshots.find((snap) => snap.category === category)?.girone;
    if (!source?.enabled || !girone) return { error: "Il calendario ufficiale non è disponibile: aggiorna e riprova." };

    const { items } = computeCalendarImport({
      category,
      girone,
      aliases: source.teamAliases,
      matches,
      decisions,
    });
    const chosen = items.filter((item) => wanted.has(item.official.externalId));
    if (chosen.length === 0) {
      return { error: "Queste partite sono già nel calendario: aggiorna la pagina." };
    }

    // Una alla volta: se qualcosa si interrompe, quelle già create restano abbinate e non si duplicano al secondo tentativo.
    let added = 0;
    try {
      for (const item of chosen) {
        const created = await repo.createMatch(matchInputFromOfficial(category, item.official, item.side), session.sub);
        await repo.setFederationDecision({
          category,
          externalId: item.official.externalId,
          decision: "linked",
          matchId: created.id,
          decidedBy: session.sub,
        });
        added++;
      }
    } finally {
      if (added > 0) revalidateAll();
    }

    if (notify) {
      await notifyCalendarChange(
        {
          title: "Calendario aggiornato",
          body: `${added === 1 ? "Nuova partita" : `${added} nuove partite`} ${CATEGORY_LABELS[category]} in calendario.`,
          url: "/",
        },
        "u14u15",
      );
    }
    return { message: added === 1 ? "Aggiunta 1 partita al calendario." : `Aggiunte ${added} partite al calendario.` };
  } catch (error) {
    console.error("[importOfficialCalendarAction]", error);
    return { error: "Non è stato possibile aggiungere tutte le partite. Controlla l'elenco e riprova." };
  }
}

/** Data e ora per una notifica, es. «sab 24 ott · ore 15:30». */
function whenForNotification(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const day = date.toLocaleDateString("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return `${day} · ore ${iso.slice(11, 16)}`;
}

/**
 * «Aggiorna le date»: porta nel sito la data e l'ora ufficiali delle partite
 * scelte da un admin, quando sul portale sono cambiate (gara spostata). Cambia
 * solo la data: palestra, ritrovo, convocazioni e il resto restano come sono.
 * Ricalcola dai dati salvati, mai da quello che arriva dal browser.
 */
export async function updateOfficialDatesAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  await requireStaffPage("partite");
  const category = parseCategory(formData.get("category"));
  const wanted = new Set(formData.getAll("externalId").map((value) => value.toString()));
  const notify = formData.get("notify") === "on";
  if (!category) return { error: "Dati mancanti: aggiorna la pagina e riprova." };
  if (wanted.size === 0) return { error: "Scegli almeno una partita da aggiornare." };

  try {
    const repo = await getActiveRepo();
    const [sources, snapshots, decisions, matches] = await Promise.all([
      repo.listFederationSources(),
      repo.listFederationSnapshots(),
      repo.listFederationDecisions(),
      repo.listMatches({ team: "u14u15" }),
    ]);
    const source = sources.find((src) => src.category === category);
    const girone = snapshots.find((snap) => snap.category === category)?.girone;
    if (!source?.enabled || !girone) return { error: "Il calendario ufficiale non è disponibile: aggiorna e riprova." };

    const { dateChanges } = computeCalendarImport({
      category,
      girone,
      aliases: source.teamAliases,
      matches,
      decisions,
    });
    const chosen = dateChanges.filter((change) => wanted.has(change.official.externalId));
    if (chosen.length === 0) return { error: "Queste date sono già aggiornate: ricarica la pagina." };

    let updated = 0;
    try {
      for (const { match, official } of chosen) {
        const input: MatchInput = {
          team: match.team,
          category: match.category,
          opponent: match.opponent,
          isHome: match.isHome,
          isFriendly: match.isFriendly,
          isTournament: match.isTournament,
          location: match.location,
          matchDate: official.date.slice(0, 16),
          meetingTime: match.meetingTime,
          meetingLocation: match.meetingLocation,
          notes: match.notes,
          calledUpAthleteIds: match.calledUpAthleteIds,
          setScores: match.setScores,
          resultSetsWon: match.resultSetsWon,
          resultSetsLost: match.resultSetsLost,
          tournamentGames: match.tournamentGames,
        };
        await repo.updateMatch(match.id, input);
        updated++;
      }
    } finally {
      if (updated > 0) revalidateAll();
    }

    if (notify) {
      const first = chosen[0];
      await notifyCalendarChange(
        {
          title: updated === 1 ? "Partita spostata" : "Calendario aggiornato",
          body:
            updated === 1
              ? `${CATEGORY_LABELS[category]} · vs ${first.opponent} · ${whenForNotification(first.official.date)}`
              : `${updated} partite ${CATEGORY_LABELS[category]} hanno cambiato data o ora.`,
          url: "/",
        },
        "u14u15",
      );
    }
    return { message: updated === 1 ? "Aggiornata 1 data." : `Aggiornate ${updated} date.` };
  } catch (error) {
    console.error("[updateOfficialDatesAction]", error);
    return { error: "Non è stato possibile aggiornare tutte le date. Controlla l'elenco e riprova." };
  }
}
