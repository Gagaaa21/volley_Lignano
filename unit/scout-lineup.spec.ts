import { expect, test } from "@playwright/test";
import {
  addPlayer,
  addRally,
  endSet,
  newScoutData,
  opponentPlayer,
  removePlayer,
  scoutReducer,
  setLineup,
  substitute,
  undoLast,
  usedPlayerIds,
  type LineupInput,
} from "@/lib/scout/actions";
import { currentServer, deriveScout } from "@/lib/scout/derive";
import { scoutDataSchema } from "@/lib/scout/schema";
import type { ScoutData, ScoutHow, ScoutSide } from "@/lib/scout/types";

/**
 * Scout con la formazione in campo (facoltativa): chi gioca in ogni posizione,
 * la libero, le rotazioni quando si conquista la battuta e i cambi: le stesse
 * regole del Live score, ricavate dagli eventi.
 */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const MIN = 60_000;

const ids = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"];

function roster(): ScoutData {
  let data = newScoutData({ us: [], opp: [] }, { firstServer: "us" });
  ids.forEach((id, i) => {
    data = addPlayer(data, "us", { id, name: `Atleta ${i + 1}`, number: String(i + 1), libero: false });
  });
  data = addPlayer(data, "us", { id: "ul", name: "Libera", number: "20", libero: true });
  for (let n = 1; n <= 8; n++) data = addPlayer(data, "opp", opponentPlayer(String(n)));
  return data;
}

/** u1…u6 nelle posizioni 1…6; le centrali sono u3 (posizione 3) e u6 (posizione 6). */
const OURS: LineupInput = {
  positions: ["u1", "u2", "u3", "u4", "u5", "u6"],
  libero: "ul",
  hosts: ["u3", "u6"],
};
const THEIRS: LineupInput = {
  positions: ["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"],
  libero: null,
  hosts: [null, null],
};

let seq = 0;
const id = () => `e${++seq}`;
const at = (data: ScoutData) => T0 + data.events.length * MIN;

function withLineups(data: ScoutData): ScoutData {
  return setLineup(setLineup(data, "us", OURS, at(data), id()), "opp", THEIRS, T0, id());
}

function point(data: ScoutData, winner: ScoutSide, how: ScoutHow = "attack"): ScoutData {
  // Punto di chi fa un attacco vincente: l'attore è chi vince.
  return addRally(data, { actor: winner, how, player: null, victim: null }, at(data), id());
}

test.describe("formazione in campo", () => {
  test("senza formazione non c'è nessun campo da seguire", () => {
    const view = deriveScout(point(roster(), "us"));
    expect(view.court).toEqual({ us: null, opp: null });
    expect(view.rallies[0].court).toEqual({ us: null, opp: null });
  });

  test("la formazione di partenza è la rotazione 1, con la libero già dentro per la centrale in seconda linea", () => {
    const view = deriveScout(withLineups(roster()));
    expect(view.court.us).toMatchObject({
      positions: ["u1", "u2", "u3", "u4", "u5", "u6"],
      rotation: 1,
      libero: "ul",
      // Batte noi: u1 in posizione 1 (non è una centrale). u6 è centrale in seconda linea: entra la libero.
      liberoFor: "u6",
    });
    expect(view.court.us?.onCourt).toEqual(["u1", "u2", "u3", "u4", "u5", "ul"]);
    expect(view.court.opp?.onCourt).toEqual(["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"]);
  });

  test("chi batte è in posizione 1: lo si ricava dalla formazione di chi ha la battuta", () => {
    const view = deriveScout(withLineups(roster()));
    expect(currentServer(view)).toBe("us");
    expect(view.court.us?.positions[0]).toBe("u1");
    // A battere per primi sono loro: il loro battitore è opp-1.
    const theirs = deriveScout(withLineups({ ...roster(), settings: { ...roster().settings, firstServer: "opp" } }));
    expect(currentServer(theirs)).toBe("opp");
    expect(theirs.court.opp?.positions[0]).toBe("opp-1");
  });

  test("chi conquista la battuta ruota, chi la tiene no", () => {
    let data = withLineups(roster());
    data = point(data, "us"); // batte noi e fa punto: nessuna rotazione
    let view = deriveScout(data);
    expect(view.court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(view.court.us?.rotation).toBe(1);

    data = point(data, "opp"); // loro conquistano la battuta: ruotano loro
    view = deriveScout(data);
    expect(view.court.opp?.positions).toEqual(["opp-2", "opp-3", "opp-4", "opp-5", "opp-6", "opp-1"]);
    expect(view.court.opp?.rotation).toBe(2);
    expect(view.court.us?.rotation).toBe(1);

    data = point(data, "us"); // riconquistiamo la battuta: ruotiamo noi
    view = deriveScout(data);
    expect(view.court.us?.positions).toEqual(["u2", "u3", "u4", "u5", "u6", "u1"]);
    expect(view.court.us?.rotation).toBe(2);
  });

  test("ogni scambio ricorda chi era in campo quando è cominciato", () => {
    let data = withLineups(roster());
    data = point(data, "opp");
    data = point(data, "opp");
    const [first, second] = deriveScout(data).rallies;
    expect(first.court.opp?.positions[0]).toBe("opp-1");
    // Dopo il punto a loro hanno conquistato la battuta e sono ruotati: batte opp-2.
    expect(second.court.opp?.positions[0]).toBe("opp-2");
    expect(first.court.us?.rotation).toBe(1);
  });

  test("la libero esce quando la centrale ruota a rete e rientra per l'altra", () => {
    let data = withLineups(roster());
    // La libero sta per u6 (posizione 6). Riconquistiamo la battuta due volte: u6 va in 5, poi in 4 (a rete).
    data = point(data, "opp"); // perdiamo la battuta
    data = point(data, "us"); // ruotiamo: u6 in 5
    data = point(data, "opp");
    data = point(data, "us"); // ruotiamo ancora: u6 in 4, a rete
    const view = deriveScout(data);
    expect(view.court.us?.positions[3]).toBe("u6");
    // In seconda linea c'è ora u3 (centrale) in posizione 1 che batte: nessuna libero.
    expect(view.court.us?.positions[0]).toBe("u3");
    expect(view.court.us?.liberoFor).toBeNull();
    expect(view.court.us?.onCourt).toEqual(["u3", "u4", "u5", "u6", "u1", "u2"]);
  });

  test("il set dopo riparte dalla formazione di partenza, con la libero ricalcolata", () => {
    let data = withLineups(roster());
    for (let i = 0; i < 24; i++) data = point(data, i % 3 === 0 ? "opp" : "us");
    // Portiamo il set a un risultato qualunque e chiudiamolo: non serve il 25.
    data = endSet(data, "opp", at(data), id());
    const view = deriveScout(data);
    expect(view.current?.n).toBe(2);
    expect(view.court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(view.court.us?.rotation).toBe(1);
    expect(view.court.opp?.positions).toEqual(["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"]);
    // Batte loro: noi riceviamo, quindi anche la centrale in posizione 6 resta sostituita dalla libero.
    expect(view.court.us?.liberoFor).toBe("u6");
    // E la formazione di partenza del 1° set è quella ricordata.
    expect(view.sets[0].lineups.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
  });

  test("una nuova formazione prima del primo scambio del set è la nuova partenza", () => {
    let data = withLineups(roster());
    data = point(data, "us");
    data = endSet(data, "opp", at(data), id());
    const changed: LineupInput = { ...OURS, positions: ["u2", "u1", "u3", "u4", "u5", "u6"] };
    data = setLineup(data, "us", changed, at(data), id());
    data = point(data, "us");
    data = point(data, "opp");
    const view = deriveScout(data);
    expect(view.sets[1].lineups.us?.positions).toEqual(["u2", "u1", "u3", "u4", "u5", "u6"]);
  });

  test("scrivere di nuovo la formazione subito dopo la sostituisce, non la accumula", () => {
    let data = withLineups(roster());
    const before = data.events.length;
    data = setLineup(data, "opp", { ...THEIRS, positions: ["opp-2", "opp-1", "opp-3", "opp-4", "opp-5", "opp-6"] }, at(data), id());
    expect(data.events.length).toBe(before);
    expect(deriveScout(data).court.opp?.positions[0]).toBe("opp-2");
    // Dopo un punto invece resta nel registro come correzione.
    data = point(data, "us");
    const withPoint = data.events.length;
    data = setLineup(data, "opp", THEIRS, at(data), id());
    expect(data.events.length).toBe(withPoint + 1);
  });

  test("giocatrici che non sono in rosa o ripetute non entrano nella formazione", () => {
    const data = setLineup(roster(), "us", { positions: ["u1", "u1", "zzz", "u4", "u5", "u6"], libero: "u4", hosts: ["u9", "u5"] }, T0, id());
    const event = data.events[0];
    expect(event.type === "lineup" && event.positions).toEqual(["u1", null, null, "u4", "u5", "u6"]);
    // La libero non può essere anche in campo tra le sei; una sostituita deve stare tra le sei.
    expect(event.type === "lineup" && event.libero).toBeNull();
    expect(event.type === "lineup" && event.hosts).toEqual([null, "u5"]);
  });
});

test.describe("cambi", () => {
  test("entra chi è in panchina al posto di chi sta in quella posizione", () => {
    let data = withLineups(roster());
    data = point(data, "us");
    data = substitute(data, "us", 2, "u7", at(data), id());
    const view = deriveScout(data);
    expect(view.court.us?.positions).toEqual(["u1", "u7", "u3", "u4", "u5", "u6"]);
    expect(view.sets[0].subs).toHaveLength(1);
    expect(view.sets[0].subs[0]).toMatchObject({ side: "us", position: 2, out: "u2", in: "u7", score: { us: 1, opp: 0 } });
  });

  test("chi entra eredita il ruolo della centrale sostituita", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 6, "u7", at(data), id());
    const court = deriveScout(data).court.us;
    expect(court?.hosts).toEqual(["u3", "u7"]);
    // La libero resta dentro per chi è entrata al posto di u6.
    expect(court?.liberoFor).toBe("u7");
    expect(court?.onCourt[5]).toBe("ul");
  });

  test("non si fa un cambio con chi è già in campo, con la libero o con chi non è in rosa", () => {
    const data = withLineups(roster());
    expect(substitute(data, "us", 2, "u4", at(data), id())).toBe(data);
    expect(substitute(data, "us", 2, "ul", at(data), id())).toBe(data);
    expect(substitute(data, "us", 2, "nessuna", at(data), id())).toBe(data);
    // Senza formazione di quella squadra non c'è nessuno da sostituire.
    const noLineup = setLineup(roster(), "us", OURS, T0, id());
    expect(substitute(noLineup, "opp", 2, "opp-7", at(noLineup), id())).toBe(noLineup);
  });

  test("«Annulla ultimo» toglie anche un cambio o una formazione", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id());
    expect(deriveScout(undoLast(data)).court.us?.positions[1]).toBe("u2");
    expect(deriveScout(undoLast(undoLast(undoLast(data)))).court.us).toBeNull();
  });

  test("chi compare in una formazione o in un cambio non si toglie dalla rosa", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id());
    const used = usedPlayerIds(data);
    for (const player of ["u1", "u6", "ul", "u7"]) expect(used.has(player)).toBe(true);
    expect(removePlayer(data, "us", "u7")).toBe(data);
    expect(removePlayer(data, "us", "u8").roster.us.some((p) => p.id === "u8")).toBe(false);
  });
});

test.describe("salvataggio", () => {
  test("formazioni e cambi passano la validazione e si rileggono uguali", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id());
    const parsed = scoutDataSchema.parse(JSON.parse(JSON.stringify(data)));
    expect(parsed.events).toEqual(data.events);
    expect(deriveScout(parsed).court.us?.positions[1]).toBe("u7");
  });

  test("una formazione con meno di sei posizioni viene rifiutata", () => {
    const data = withLineups(roster());
    const broken = JSON.parse(JSON.stringify(data));
    broken.events[0].positions = ["u1", "u2"];
    expect(scoutDataSchema.safeParse(broken).success).toBe(false);
  });

  test("il reducer le applica come le altre azioni", () => {
    let data = roster();
    data = scoutReducer(data, { type: "lineup", side: "us", input: OURS, at: T0, id: "l1" });
    data = scoutReducer(data, { type: "sub", side: "us", position: 1, player: "u7", at: T0 + MIN, id: "s1" });
    expect(deriveScout(data).court.us?.positions[0]).toBe("u7");
  });
});
