import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { buildTripPdf, tripPdfContent } from "@/lib/pdf/tripPdf";
import { ADMIN_PAGES, DEFAULT_NEW_ADMIN_PAGES, isPageAvailableForTeam, type Athlete, type Match } from "@/lib/types";
import {
  contactNames,
  normalizeContacts,
  parseContactRows,
  phoneForName,
} from "@/lib/trips/contacts";
import { cleanPhone, isValidPhone, nameKey, phoneHref } from "@/lib/trips/phone";
import {
  addVehicle,
  assignAthlete,
  normalizeTripData,
  removeVehicle,
  seatsLeft,
  summarizeTrip,
  tripStatus,
  unassignAthlete,
  updateVehicle,
  vehicleOf,
  type VehicleFields,
} from "@/lib/trips/rules";
import { MAX_VEHICLES, emptyTripData, type AthleteContacts, type MatchTripData } from "@/lib/trips/types";

/**
 * Le regole delle trasferte, senza database né pagina: posti, chi sta su quale mezzo, riepilogo e lettura difensiva di quanto
 * salvato; i numeri di telefono; la rubrica dei genitori.
 */

const fields = (overrides: Partial<VehicleFields> = {}): VehicleFields => ({
  kind: "auto",
  driverName: "Mario Rossi",
  driverPhone: "333 1234567",
  seats: 3,
  departureTime: null,
  departurePlace: null,
  notes: null,
  ...overrides,
});

/** Una trasferta con due mezzi: «a» da 2 posti e «b» da 3. */
function twoVehicles(): MatchTripData {
  let data = emptyTripData();
  const first = addVehicle(data, fields({ seats: 2 }), "a");
  if (!first.ok) throw new Error(first.error);
  const second = addVehicle(first.data, fields({ driverName: "Anna Verdi", seats: 3 }), "b");
  if (!second.ok) throw new Error(second.error);
  data = second.data;
  return data;
}

function assign(data: MatchTripData, athleteId: string, vehicleId: string): MatchTripData {
  const result = assignAthlete(data, athleteId, vehicleId);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

test.describe("numeri di telefono", () => {
  test("si accettano cifre, spazi, trattini, parentesi e un + iniziale", () => {
    for (const phone of ["333 1234567", "333-123-4567", "+39 333 1234567", "(0431) 123456", "0039 333 1234567", "0431/123456"]) {
      expect(isValidPhone(phone), phone).toBe(true);
    }
  });

  test("non sono numeri: lettere, troppo corti o troppo lunghi, + in mezzo, vuoto", () => {
    for (const phone of ["", "   ", "mamma", "12345", "3331234567890123", "333+1234567", "333 12a4567", "<script>"]) {
      expect(isValidPhone(phone), phone).toBe(false);
    }
  });

  test("il link per chiamare toglie spazi e simboli e riconosce il prefisso internazionale", () => {
    expect(phoneHref("333 123 4567")).toBe("tel:3331234567");
    expect(phoneHref("+39 333 123 4567")).toBe("tel:+393331234567");
    expect(phoneHref("0039 333 1234567")).toBe("tel:+393331234567");
    expect(phoneHref("(0431) 123-456")).toBe("tel:0431123456");
    expect(phoneHref("mamma")).toBeNull();
  });

  test("gli spazi in più si tolgono, le cifre restano", () => {
    expect(cleanPhone("  333   123  4567 ")).toBe("333 123 4567");
  });

  test("il nome si riconosce anche con maiuscole, accenti e spazi diversi", () => {
    expect(nameKey("  Nicolò   DELL'ORTO ")).toBe(nameKey("nicolo dell'orto"));
    expect(nameKey("Mario Rossi")).not.toBe(nameKey("Mario Rossini"));
  });
});

test.describe("mezzi e posti", () => {
  test("un mezzo nuovo parte vuoto e i posti sono quelli dichiarati", () => {
    const data = twoVehicles();
    expect(data.vehicles.map((v) => [v.id, seatsLeft(v)])).toEqual([
      ["a", 2],
      ["b", 3],
    ]);
  });

  test("non si superano i mezzi consentiti", () => {
    let data = emptyTripData();
    for (let i = 0; i < MAX_VEHICLES; i++) {
      const next = addVehicle(data, fields(), `v${i}`);
      if (!next.ok) throw new Error(next.error);
      data = next.data;
    }
    const tooMany = addVehicle(data, fields(), "extra");
    expect(tooMany.ok).toBe(false);
  });

  test("un'atleta sale su un mezzo; riempito il mezzo, nessun'altra sale", () => {
    let data = twoVehicles();
    data = assign(data, "anna", "a");
    data = assign(data, "bea", "a");
    expect(seatsLeft(data.vehicles[0])).toBe(0);
    const full = assignAthlete(data, "carla", "a");
    expect(full).toEqual({ ok: false, error: "Il mezzo è pieno: non ci sono più posti." });
  });

  test("metterla di nuovo sullo stesso mezzo non fa niente; su un altro la sposta, senza averla due volte", () => {
    let data = assign(twoVehicles(), "anna", "a");
    expect(assign(data, "anna", "a")).toEqual(data);
    data = assign(data, "anna", "b");
    expect(data.vehicles.map((v) => v.athleteIds)).toEqual([[], ["anna"]]);
    expect(vehicleOf(data, "anna")?.id).toBe("b");
  });

  test("spostare su un mezzo pieno non toglie l'atleta dal suo", () => {
    let data = twoVehicles();
    data = assign(data, "anna", "a");
    data = assign(data, "bea", "a");
    data = assign(data, "carla", "b");
    const blocked = assignAthlete(data, "carla", "a");
    expect(blocked.ok).toBe(false);
    expect(vehicleOf(data, "carla")?.id).toBe("b");
  });

  test("un mezzo che non c'è più si dice a parole", () => {
    expect(assignAthlete(twoVehicles(), "anna", "zzz")).toEqual({ ok: false, error: "Questo mezzo non c'è più." });
  });

  test("togliere l'atleta la lascia senza passaggio; non cambia il documento di partenza", () => {
    const before = assign(twoVehicles(), "anna", "a");
    const snapshot = structuredClone(before);
    const after = unassignAthlete(before, "anna");
    expect(vehicleOf(after, "anna")).toBeUndefined();
    expect(before).toEqual(snapshot);
  });

  test("i posti non scendono sotto chi c'è già sopra", () => {
    const data = assign(assign(twoVehicles(), "anna", "b"), "bea", "b");
    const tooFew = updateVehicle(data, "b", fields({ seats: 1 }));
    expect(tooFew).toEqual({
      ok: false,
      error: "Su questo mezzo ci sono già 2 atlete: togline qualcuna prima di ridurre i posti.",
    });
    const ok = updateVehicle(data, "b", fields({ driverName: "Anna Verdi", seats: 2 }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.vehicles[1].athleteIds).toEqual(["anna", "bea"]);
  });

  test("con una sola atleta sopra il messaggio è al singolare", () => {
    const data = assign(twoVehicles(), "anna", "b");
    const result = updateVehicle(data, "b", fields({ seats: 0 }));
    expect(result).toEqual({ ok: false, error: "Su questo mezzo c'è già 1 atleta: toglila prima di ridurre i posti." });
  });

  test("togliere un mezzo lascia senza passaggio chi c'era sopra", () => {
    const data = assign(twoVehicles(), "anna", "a");
    const after = removeVehicle(data, "a");
    expect(after.vehicles.map((v) => v.id)).toEqual(["b"]);
    expect(vehicleOf(after, "anna")).toBeUndefined();
  });
});

test.describe("riepilogo della trasferta", () => {
  test("conta mezzi, posti, convocate con e senza passaggio", () => {
    let data = twoVehicles(); // 5 posti
    data = assign(data, "anna", "a");
    data = assign(data, "bea", "b");
    const summary = summarizeTrip(data, ["anna", "bea", "carla", "dora"]);
    expect(summary).toEqual({
      vehicles: 2,
      seats: 5,
      seatsFree: 3,
      calledUp: 4,
      placed: 2,
      unplaced: ["carla", "dora"],
      notCalledUp: [],
    });
  });

  test("chi è su un mezzo ma non è più convocata si segnala a parte, e occupa comunque il posto", () => {
    const data = assign(twoVehicles(), "ex", "a");
    const summary = summarizeTrip(data, ["anna"]);
    expect(summary.notCalledUp).toEqual(["ex"]);
    expect(summary.unplaced).toEqual(["anna"]);
    expect(summary.seatsFree).toBe(4);
  });

  test("lo stato dice a che punto si è", () => {
    expect(tripStatus(summarizeTrip(emptyTripData(), []))).toBe("no-called-up");
    expect(tripStatus(summarizeTrip(emptyTripData(), ["anna"]))).toBe("no-vehicles");
    expect(tripStatus(summarizeTrip(twoVehicles(), ["anna"]))).toBe("missing");
    expect(tripStatus(summarizeTrip(assign(twoVehicles(), "anna", "a"), ["anna"]))).toBe("done");
  });
});

test.describe("lettura di quanto salvato", () => {
  test("un documento rovinato o vuoto non rompe niente", () => {
    expect(normalizeTripData(null)).toEqual(emptyTripData());
    expect(normalizeTripData("boh")).toEqual(emptyTripData());
    expect(normalizeTripData({ vehicles: "no" })).toEqual(emptyTripData());
  });

  test("scarta i mezzi senza autista o con posti assurdi e tiene i buoni", () => {
    const data = normalizeTripData({
      vehicles: [
        { id: "ok", kind: "pulmino", driverName: "Luca", seats: 8, athleteIds: ["a", "b"] },
        { id: "senza-autista", kind: "auto", driverName: "  ", seats: 3, athleteIds: [] },
        { id: "troppi-posti", kind: "auto", driverName: "Paolo", seats: 500, athleteIds: [] },
        "spazzatura",
      ],
      notes: "  pranzo al sacco  ",
    });
    expect(data.vehicles.map((v) => v.id)).toEqual(["ok"]);
    expect(data.vehicles[0].kind).toBe("pulmino");
    expect(data.notes).toBe("pranzo al sacco");
  });

  test("un tipo sconosciuto diventa «altro»; un'atleta è su un mezzo solo e dentro i posti", () => {
    const data = normalizeTripData({
      vehicles: [
        { id: "a", kind: "elicottero", driverName: "Luca", seats: 2, athleteIds: ["x", "y", "z"] },
        { id: "b", kind: "auto", driverName: "Anna", seats: 3, athleteIds: ["x", "w"] },
      ],
    });
    expect(data.vehicles[0].kind).toBe("altro");
    expect(data.vehicles.map((v) => v.athleteIds)).toEqual([["x", "y"], ["w"]]);
  });
});

test.describe("rubrica dei genitori", () => {
  test("righe vuote ignorate; nome e numero vanno insieme; il numero deve essere un numero", () => {
    expect(parseContactRows([{ name: "", phone: "", relation: "" }])).toEqual({ ok: true, contacts: [] });
    expect(parseContactRows([{ name: "Giulia", phone: "", relation: "" }])).toEqual({
      ok: false,
      error: "Riga 1: manca il numero di Giulia.",
    });
    expect(parseContactRows([{ name: "", phone: "333 1234567", relation: "mamma" }])).toEqual({
      ok: false,
      error: "Riga 1: scrivi il nome di chi si deve chiamare.",
    });
    const bad = parseContactRows([
      { name: "", phone: "", relation: "" },
      { name: "Giulia", phone: "abc", relation: "" },
    ]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/^Riga 2: il numero di Giulia non sembra un numero/);
  });

  test("tiene nome, numero e relazione ripuliti; lo stesso numero due volte conta una volta", () => {
    const parsed = parseContactRows([
      { name: "  Giulia   Bianchi ", phone: " 333  1234567 ", relation: " mamma " },
      { name: "Giulia B.", phone: "3331234567", relation: "" },
      { name: "Paolo Bianchi", phone: "+39 340 7654321", relation: "" },
    ]);
    expect(parsed).toEqual({
      ok: true,
      contacts: [
        { name: "Giulia Bianchi", phone: "333 1234567", relation: "mamma" },
        { name: "Paolo Bianchi", phone: "+39 340 7654321", relation: null },
      ],
    });
  });

  test("rileggendo, le righe rovinate si scartano e al massimo ne restano quattro", () => {
    const contacts = normalizeContacts([
      { name: "A", phone: "333 1111111" },
      { name: "", phone: "333 2222222" },
      { name: "B", phone: "non è un numero" },
      42,
      { name: "C", phone: "333 3333333", relation: "papà" },
      { name: "D", phone: "333 4444444" },
      { name: "E", phone: "333 5555555" },
      { name: "F", phone: "333 6666666" },
    ]);
    expect(contacts.map((c) => c.name)).toEqual(["A", "C", "D", "E"]);
    expect(contacts[1].relation).toBe("papà");
  });

  const rubrica: AthleteContacts[] = [
    {
      athleteId: "1",
      contacts: [
        { name: "Mario Rossi", phone: "333 1234567", relation: "papà" },
        { name: "Giulia Bianchi", phone: "340 7654321", relation: "mamma" },
      ],
      updatedBy: null,
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
    {
      athleteId: "2",
      contacts: [{ name: "mario  rossi", phone: "3331234567", relation: null }],
      updatedBy: null,
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
  ];

  test("il numero di chi guida si prende dalla rubrica se il nome è uno solo (anche scritto in modo diverso)", () => {
    expect(phoneForName(rubrica, "MARIO ROSSI")).toBe("333 1234567");
    expect(phoneForName(rubrica, "Giulia Bianchi")).toBe("340 7654321");
    expect(phoneForName(rubrica, "Luca Neri")).toBeNull();
    expect(phoneForName(rubrica, "   ")).toBeNull();
  });

  test("con due numeri diversi per lo stesso nome non si sceglie al posto di chi compila", () => {
    const ambiguous: AthleteContacts[] = [
      ...rubrica,
      { athleteId: "3", contacts: [{ name: "Mario Rossi", phone: "320 9999999", relation: null }], updatedBy: null, updatedAt: "" },
    ];
    expect(phoneForName(ambiguous, "Mario Rossi")).toBeNull();
  });

  test("i nomi per i suggerimenti sono uno per persona, in ordine", () => {
    expect(contactNames(rubrica)).toEqual(["Giulia Bianchi", "Mario Rossi"]);
  });
});

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U15",
    opponent: "Pallavolo Udine",
    isHome: false,
    location: "Palestra di Udine",
    matchDate: "2026-11-21T18:00",
    isFriendly: false,
    isTournament: false,
    meetingTime: "16:30",
    meetingLocation: "Piazzale del palazzetto",
    notes: null,
    calledUpAthleteIds: ["anna", "bea", "carla"],
    setScores: null,
    resultSetsWon: null,
    resultSetsLost: null,
    tournamentGames: null,
    createdBy: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const athlete = (id: string, fullName: string): Athlete => ({
  id,
  fullName,
  team: "u14u15",
  category: "U15",
  group: null,
  jerseyNumber: null,
  isActive: true,
  notes: null,
  createdBy: null,
  createdAt: "",
  updatedAt: "",
});

const ATHLETES = [athlete("anna", "Anna Bianchi"), athlete("bea", "Bea Neri"), athlete("carla", "Carla Verdi")];

test.describe("riepilogo PDF della trasferta", () => {
  /** Due mezzi: l'auto di Mario (con Anna) e il pulmino di Anna Verdi; Carla senza passaggio. Note e numeri ci sono tutti. */
  function sampleTrip(): MatchTripData {
    const data = assign(twoVehicles(), "anna", "a");
    return {
      ...data,
      notes: "Rimborso benzina in contanti: NOTA-RISERVATA",
      vehicles: data.vehicles.map((vehicle) =>
        vehicle.id === "a"
          ? { ...vehicle, driverPhone: "333 1234567", departureTime: "15:30", departurePlace: "Stazione" }
          : { ...vehicle, driverPhone: "340 7654321" },
      ),
    };
  }

  test("senza i numeri richiesti nel foglio non c'è nessun numero di telefono, né le note riservate", () => {
    const content = tripPdfContent({ match: match(), data: sampleTrip(), athletes: ATHLETES, includeDriverNumbers: false });
    const everything = JSON.stringify(content);
    expect(everything).not.toContain("333 1234567");
    expect(everything).not.toContain("340 7654321");
    expect(everything).not.toContain("NOTA-RISERVATA");
    expect(content.vehicles[0].sub).toBe("Auto");
  });

  test("con i numeri richiesti compaiono quelli degli autisti, e solo quelli", () => {
    const content = tripPdfContent({ match: match(), data: sampleTrip(), athletes: ATHLETES, includeDriverNumbers: true });
    expect(content.vehicles.map((v) => v.sub)).toEqual(["Auto · 333 1234567", "Auto · 340 7654321"]);
    expect(JSON.stringify(content)).not.toContain("NOTA-RISERVATA");
  });

  test("dice la partita, il ritrovo, i mezzi con chi ci sale, i posti e chi è ancora senza passaggio", () => {
    const content = tripPdfContent({ match: match(), data: sampleTrip(), athletes: ATHLETES, includeDriverNumbers: false });
    expect(content.when).toBe("21 novembre 2026 · ore 18:00 · Palestra di Udine");
    expect(content.meeting).toBe("Ritrovo: ore 16:30 · Piazzale del palazzetto");
    expect(content.totals).toBe("2 mezzi · 5 posti");
    expect(content.vehicles[0]).toMatchObject({
      driver: "Mario Rossi",
      departure: "ore 15:30\nStazione",
      passengers: ["Anna Bianchi"],
      taken: 1,
      seats: 2,
      full: false,
      free: 1,
    });
    expect(content.vehicles[1].departure).toBeNull();
    expect(content.unplaced).toEqual(["Bea Neri", "Carla Verdi"]);
  });

  test("senza ritrovo scritto vale l'orario della partita", () => {
    const content = tripPdfContent({
      match: match({ meetingTime: null, meetingLocation: null }),
      data: emptyTripData(),
      athletes: ATHLETES,
      includeDriverNumbers: false,
    });
    expect(content.meeting).toBe("Ritrovo: all'orario della partita");
    expect(content.totals).toBe("0 mezzi · 0 posti");
  });

  test("il PDF si genera valido, anche con nomi insoliti e senza nessun mezzo", async () => {
    const odd = [athlete("anna", "Nicolò Dell'Orto-Müller 🏐"), ...ATHLETES.slice(1)];
    const full = await buildTripPdf({ match: match(), data: sampleTrip(), athletes: odd, includeDriverNumbers: true });
    expect(Buffer.from(full.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect((await PDFDocument.load(full)).getPageCount()).toBeGreaterThanOrEqual(1);
    const empty = await buildTripPdf({ match: match(), data: emptyTripData(), athletes: ATHLETES, includeDriverNumbers: false });
    expect(Buffer.from(empty.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });
});

test.describe("sezione riservata", () => {
  test("«Trasferte» è un permesso a sé: non c'è di default per i nuovi Admin e non esiste per il Minivolley", () => {
    expect(ADMIN_PAGES).toContain("trasferte");
    expect(DEFAULT_NEW_ADMIN_PAGES).not.toContain("trasferte");
    expect(isPageAvailableForTeam("trasferte", "u14u15")).toBe(true);
    expect(isPageAvailableForTeam("trasferte", "minivolley")).toBe(false);
    // Le altre pagine di default non cambiano.
    expect(DEFAULT_NEW_ADMIN_PAGES).toContain("pronostici");
  });
});
