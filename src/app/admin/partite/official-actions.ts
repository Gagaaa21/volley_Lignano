"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getActiveRepo, getRepo, type Repo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { CATEGORY_LABELS } from "@/lib/category";
import { matchInputFromOfficial } from "@/lib/federation/calendarImport";
import { MIN_NAME_SCORE, nameSimilarity, ourSide } from "@/lib/federation/matching";
import { computePortalView, type PortalCategoryView, type PortalGame } from "@/lib/federation/portal";
import { orientResult, sameResult, type OrientedResult } from "@/lib/federation/proposals";
import { MANUAL_REFRESH_MIN_INTERVAL_MS, refreshFederation } from "@/lib/federation/refresh";
import type { FederationDecision } from "@/lib/federation/types";
import { notifyCalendarChange } from "@/lib/push";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import { validateSetScorePairs } from "@/lib/setScores";
import type { Category, Match, MatchInput } from "@/lib/types";

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

/** Dopo ogni cambiamento: portale, elenco admin, dashboard e sito pubblico. */
function revalidateAll(matchId?: string) {
  revalidatePath("/admin/partite");
  revalidatePath("/admin/partite/portale");
  revalidatePath("/admin");
  if (matchId) revalidatePath(`/admin/partite/${matchId}`);
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
}

/** Tutto ciò che serve per decidere su una categoria, riletto dai dati salvati
 * (mai da quello che arriva dal browser): così due clic o due admin insieme
 * non creano doppioni né sovrascrivono scelte appena fatte. */
async function loadCategory(
  repo: Repo,
  category: Category,
): Promise<{ view: PortalCategoryView; decisions: FederationDecision[]; matches: Match[] } | null> {
  const [sources, snapshots, decisions, matches] = await Promise.all([
    repo.listFederationSources(),
    repo.listFederationSnapshots(),
    repo.listFederationDecisions(),
    repo.listMatches({ team: "u14u15" }),
  ]);
  const source = sources.find((src) => src.category === category);
  const girone = snapshots.find((snap) => snap.category === category)?.girone;
  if (!source?.enabled || !girone) return null;
  const view = computePortalView({ category, girone, aliases: source.teamAliases, matches, decisions });
  return { view, decisions, matches };
}

/** Partita di campionato della squadra U14/U15 nella categoria giusta (le sole che hanno una gara ufficiale). */
function isLeagueMatch(match: Match | null | undefined, category: Category): match is Match {
  return Boolean(
    match && match.team === "u14u15" && match.category === category && !match.isFriendly && !match.isTournament,
  );
}

function inputFromMatch(match: Match): MatchInput {
  return {
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
    setScores: match.setScores,
    resultSetsWon: match.resultSetsWon,
    resultSetsLost: match.resultSetsLost,
    tournamentGames: match.tournamentGames,
  };
}

/** Parziali ufficiali pronti da salvare, o il motivo per cui non si può. */
function resultFields(
  result: OrientedResult | null,
): { ok: true; fields: Pick<MatchInput, "setScores" | "resultSetsWon" | "resultSetsLost"> } | { ok: false; error: string } {
  if (!result) return { ok: false, error: "Questa gara non ha ancora un risultato." };
  if (!result.sets) return { ok: false, error: "Il portale non ha ancora pubblicato i parziali di questa gara." };
  // Come per i tornei: non tutte le formule giovanili chiudono a 3 set vinti.
  const parsed = validateSetScorePairs(
    result.sets.map((set) => ({ us: String(set.us), them: String(set.them) })),
    { requireThreeSetWins: false },
  );
  if (parsed.error || !parsed.setScores || parsed.resultSetsWon === null || parsed.resultSetsLost === null) {
    return { ok: false, error: parsed.error ?? "Parziali ufficiali non validi." };
  }
  // Limite dell'archivio: al massimo 3 set vinti da una squadra.
  if (parsed.resultSetsWon > 3 || parsed.resultSetsLost > 3) {
    return { ok: false, error: "Risultato con più di 3 set vinti: va inserito a mano dalla scheda della partita." };
  }
  return {
    ok: true,
    fields: { setScores: parsed.setScores, resultSetsWon: parsed.resultSetsWon, resultSetsLost: parsed.resultSetsLost },
  };
}

/** Dati della partita del sito portati a quelli della gara ufficiale (solo
 * per una gara da giocare): data e ora sempre; avversaria, casa/trasferta e
 * palestra solo se è davvero un'altra gara (la federazione a volte rivede gli
 * abbinamenti tenendo i numeri di gara). Ritrovo, note e convocazioni restano. */
function alignToPortal(input: MatchInput, match: Match, game: PortalGame): MatchInput {
  const fromPortal = matchInputFromOfficial(game.category, game.official, game.side);
  const opponentClub = game.side === "home" ? game.official.awayClub : game.official.homeClub;
  const differentOpponent = nameSimilarity(match.opponent, [game.opponent, opponentClub]) < MIN_NAME_SCORE;
  const differentSide = match.isHome !== (game.side === "home");
  const differentGame = differentOpponent || differentSide;
  return {
    ...input,
    matchDate: game.official.date.slice(0, 16),
    opponent: differentGame ? fromPortal.opponent : input.opponent,
    isHome: differentGame ? fromPortal.isHome : input.isHome,
    location: differentGame ? fromPortal.location : input.location,
  };
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
    const parsed = resultFields(result);
    if (!parsed.ok) return { error: parsed.error };

    if (!isLeagueMatch(match, category)) {
      return { error: "La partita scelta non è una partita di campionato di questa categoria." };
    }
    const alreadyLinked = decisions.find(
      (d) =>
        d.category === category && d.decision === "linked" && d.matchId === match.id && d.externalId !== externalId,
    );
    if (alreadyLinked) return { error: "Questa partita è già abbinata a un'altra gara ufficiale." };

    const hasResult = match.resultSetsWon !== null && match.resultSetsLost !== null;
    if (hasResult && result && !sameResult(match, result) && !overwrite) {
      return { error: "Nel sito c'è già un risultato diverso: non lo cambio senza una tua scelta esplicita." };
    }

    await repo.updateMatch(match.id, { ...inputFromMatch(match), ...parsed.fields });
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

/** «Conferma tutti»: salva in un colpo i risultati ufficiali di tutte le
 * partite del sito che non ne hanno ancora uno. Mai quelli in conflitto con
 * un risultato già scritto a mano. */
export async function confirmAllResultsAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  const session = await requireStaffPage("partite");
  const only = parseCategory(formData.get("category"));
  const categories: Category[] = only ? [only] : ["U14", "U15"];

  let saved = 0;
  let skipped = 0;
  try {
    const repo = await getActiveRepo();
    try {
      for (const category of categories) {
        const loaded = await loadCategory(repo, category);
        if (!loaded) continue;
        for (const game of loaded.view.games) {
          if (game.status !== "result" || !game.match) continue;
          const parsed = resultFields(game.result);
          if (!parsed.ok) {
            skipped++;
            continue;
          }
          await repo.updateMatch(game.match.id, { ...inputFromMatch(game.match), ...parsed.fields });
          await repo.setFederationDecision({
            category,
            externalId: game.official.externalId,
            decision: "linked",
            matchId: game.match.id,
            decidedBy: session.sub,
          });
          saved++;
        }
      }
    } finally {
      if (saved > 0) revalidateAll();
    }
  } catch (error) {
    console.error("[confirmAllResultsAction]", error);
    return { error: "Non è stato possibile salvare tutti i risultati. Controlla l'elenco e riprova." };
  }

  if (saved === 0) return { error: skipped > 0 ? "Questi risultati vanno inseriti a mano." : "Nessun risultato da confermare." };
  const message = saved === 1 ? "Salvato 1 risultato." : `Salvati ${saved} risultati.`;
  return { message: skipped > 0 ? `${message} ${skipped} da inserire a mano.` : message };
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

/** Rimette tra le gare da decidere una gara ignorata. */
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
 * «Aggiungi»: crea nel sito le gare ufficiali scelte da un admin tra quelle
 * che mancano e le abbina alla gara, così i risultati arriveranno poi già
 * collegati. Una gara già giocata viene creata con il suo risultato
 * ufficiale (se i parziali sono pubblicati). Ricalcola tutto dai dati
 * salvati: una partita già presente non si duplica, anche con due clic o due
 * admin insieme. La notifica, se richiesta, parla solo delle gare da giocare.
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
    const loaded = await loadCategory(repo, category);
    if (!loaded) return { error: "Il calendario ufficiale non è disponibile: aggiorna e riprova." };

    const chosen = loaded.view.games.filter(
      (game) =>
        wanted.has(game.official.externalId) &&
        (game.status === "to-add" || game.status === "maybe-same" || game.status === "played-missing"),
    );
    if (chosen.length === 0) {
      return { error: "Queste partite sono già nel calendario: aggiorna la pagina." };
    }

    // Una alla volta: se qualcosa si interrompe, quelle già create restano abbinate e non si duplicano al secondo tentativo.
    let added = 0;
    let upcoming = 0;
    try {
      for (const game of chosen) {
        const input = matchInputFromOfficial(category, game.official, game.side);
        const parsed = game.result ? resultFields(game.result) : null;
        const created = await repo.createMatch(parsed?.ok ? { ...input, ...parsed.fields } : input, session.sub);
        await repo.setFederationDecision({
          category,
          externalId: game.official.externalId,
          decision: "linked",
          matchId: created.id,
          decidedBy: session.sub,
        });
        added++;
        if (!game.result) upcoming++;
      }
    } finally {
      if (added > 0) revalidateAll();
    }

    if (notify && upcoming > 0) {
      await notifyCalendarChange(
        {
          title: "Calendario aggiornato",
          body: `${upcoming === 1 ? "Nuova partita" : `${upcoming} nuove partite`} ${CATEGORY_LABELS[category]} in calendario.`,
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

/**
 * «È la stessa partita»: collega una partita del sito a una gara ufficiale
 * scelta da un admin (data spostata, avversaria scritta in un altro modo,
 * partita inserita a mano prima dell'uscita del calendario). Poi la porta a
 * quello che dice il portale: per una gara da giocare data, ora e, se è
 * un'altra gara, avversaria e palestra; per una gara giocata il risultato
 * ufficiale, se nel sito non ce n'è già uno. Un eventuale vecchio
 * collegamento della stessa partita a un'altra gara viene tolto.
 */
export async function linkOfficialGameAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  const session = await requireStaffPage("partite");
  const category = parseCategory(formData.get("category"));
  const externalId = text(formData.get("externalId"));
  const matchId = text(formData.get("matchId"));
  if (!category || !externalId) return { error: "Dati mancanti: aggiorna la pagina e riprova." };
  if (!matchId) return { error: "Scegli la partita da collegare." };

  let message = "Partita collegata.";
  try {
    const repo = await getActiveRepo();
    const loaded = await loadCategory(repo, category);
    if (!loaded) return { error: "Il calendario ufficiale non è disponibile: aggiorna e riprova." };

    const game = loaded.view.games.find((entry) => entry.official.externalId === externalId);
    if (!game) return { error: "La gara non è più nel calendario ufficiale della squadra: aggiorna la pagina." };
    if (game.match && game.match.id !== matchId) {
      return { error: "Questa gara è già collegata a un'altra partita del sito." };
    }
    const match = loaded.matches.find((entry) => entry.id === matchId);
    if (!isLeagueMatch(match, category)) {
      return { error: "La partita scelta non è una partita di campionato di questa categoria." };
    }

    let input = inputFromMatch(match);
    const hasResult = match.resultSetsWon !== null;
    if (!game.result && !hasResult) {
      input = alignToPortal(input, match, game);
      message = "Partita collegata e aggiornata come sul portale.";
    } else if (game.result && !hasResult) {
      const parsed = resultFields(game.result);
      if (parsed.ok) {
        input = { ...input, ...parsed.fields };
        message = "Partita collegata e risultato salvato.";
      }
    }

    // Un collegamento della stessa partita a un'altra gara non vale più.
    for (const decision of loaded.decisions) {
      if (
        decision.category === category &&
        decision.decision === "linked" &&
        decision.matchId === match.id &&
        decision.externalId !== externalId
      ) {
        await repo.clearFederationDecision(category, decision.externalId);
      }
    }
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
    console.error("[linkOfficialGameAction]", error);
    return { error: "Non è stato possibile collegare la partita. Riprova." };
  }
  return { message };
}

/** Data e ora per una notifica, es. «sab 24 ott · ore 15:30». */
function whenForNotification(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const day = date.toLocaleDateString("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return `${day} · ore ${iso.slice(11, 16)}`;
}

/**
 * «Aggiorna»: porta nel sito le partite scelte da un admin a quello che dice
 * il portale quando è cambiato: data e ora, ma anche avversaria e casa /
 * trasferta (la federazione a volte rivede il calendario tenendo i numeri di
 * gara e cambiando gli abbinamenti: aggiornare solo la data lascerebbe nel
 * sito l'avversaria sbagliata). Se cambia l'avversaria o il lato, anche la
 * palestra passa a quella ufficiale. Ritrovo, note e convocazioni restano
 * come sono (l'admin li ricontrolla). Ricalcola dai dati salvati, mai da
 * quello che arriva dal browser.
 */
export async function updateOfficialGamesAction(
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
    const loaded = await loadCategory(repo, category);
    if (!loaded) return { error: "Il calendario ufficiale non è disponibile: aggiorna e riprova." };

    const chosen = loaded.view.games.filter(
      (game) => game.status === "changed" && game.match && wanted.has(game.official.externalId),
    );
    if (chosen.length === 0) return { error: "Queste partite sono già aggiornate: ricarica la pagina." };

    let updated = 0;
    try {
      for (const game of chosen) {
        const match = game.match!;
        await repo.updateMatch(match.id, alignToPortal(inputFromMatch(match), match, game));
        updated++;
      }
    } finally {
      if (updated > 0) revalidateAll();
    }

    if (notify) {
      const first = chosen[0];
      await notifyCalendarChange(
        {
          title: updated === 1 ? "Partita aggiornata" : "Calendario aggiornato",
          body:
            updated === 1
              ? `${CATEGORY_LABELS[category]} · vs ${first.opponent} · ${whenForNotification(first.official.date)}`
              : `${updated} partite ${CATEGORY_LABELS[category]} sono cambiate (avversaria, data o ora).`,
          url: "/",
        },
        "u14u15",
      );
    }
    return { message: updated === 1 ? "Aggiornata 1 partita." : `Aggiornate ${updated} partite.` };
  } catch (error) {
    console.error("[updateOfficialGamesAction]", error);
    return { error: "Non è stato possibile aggiornare tutte le partite. Controlla l'elenco e riprova." };
  }
}

/** Partita del sito senza gara ufficiale che in realtà non è di campionato:
 * diventa un'amichevole, così non viene più confrontata con il portale. */
export async function markFriendlyAction(
  _prevState: OfficialResultFormState,
  formData: FormData,
): Promise<OfficialResultFormState> {
  await requireStaffPage("partite");
  const matchId = text(formData.get("matchId"));
  if (!matchId) return { error: "Dati mancanti: aggiorna la pagina e riprova." };
  try {
    const repo = await getActiveRepo();
    const match = await repo.getMatch(matchId);
    if (!match || match.team !== "u14u15" || match.isTournament) {
      return { error: "Partita non trovata: aggiorna la pagina." };
    }
    if (!match.isFriendly) await repo.updateMatch(match.id, { ...inputFromMatch(match), isFriendly: true });
    revalidateAll(match.id);
  } catch (error) {
    console.error("[markFriendlyAction]", error);
    return { error: "Non è stato possibile salvare. Riprova." };
  }
  return { message: "Segnata come amichevole." };
}
