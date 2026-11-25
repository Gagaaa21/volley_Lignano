import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  CUE_FRESH_MS,
  defaultSoundUrl,
  CUE_KINDS,
  CUE_META,
  DEFAULT_SOUND_KINDS,
  DEFAULT_SOUNDS_VERSION,
  EMPTY_CUES,
  parseCues,
  parseSound,
  publicCueFrom,
  publicCueSounds,
  soundTypeOf,
  soundUrl,
  withCue,
  withSound,
} from "@/lib/diretta/cues";
import { CUE_CHANNEL, CUE_EVENT, realtimeSocketUrl, SUPABASE_PUBLISHABLE_KEY } from "@/lib/diretta/realtime";

/**
 * La pulsantiera della diretta: le scritte animate («MONSTER BLOCK», «ACE»…) che lo staff manda dal tablet. Si salva solo
 * l'ultima, con l'ora; al pubblico va solo se è fresca e solo con il tipo, mai una giocatrice.
 */

const T0 = Date.UTC(2026, 10, 21, 15, 0, 0);

test.describe("pulsantiera della diretta", () => {
  test("ogni tasto ha la sua scritta, e nessuna nomina una giocatrice", () => {
    expect(CUE_KINDS).toContain("monsterBlock");
    expect(CUE_KINDS).toContain("ace");
    for (const kind of CUE_KINDS) {
      expect(CUE_META[kind].title.length).toBeGreaterThan(0);
      expect(CUE_META[kind].button.length).toBeGreaterThan(0);
    }
    expect(CUE_META.monsterBlock).toMatchObject({ kicker: "MONSTER", title: "BLOCK" });
  });

  test("si salva l'ultima scritta; al pubblico va solo se è fresca, con i secondi che ha", () => {
    const stored = withCue(EMPTY_CUES, "ace", "c1", T0);
    const raw = JSON.stringify(stored);
    expect(publicCueFrom(raw, T0 + 800)).toEqual({ id: "c1", kind: "ace", age: 800, sound: null });
    expect(publicCueFrom(raw, T0 + CUE_FRESH_MS + 1)).toBeNull();
    // Un orologio del server un filo indietro non dà un'età negativa.
    expect(publicCueFrom(raw, T0 - 50)?.age).toBe(0);
    // Una nuova prende il posto della vecchia.
    expect(publicCueFrom(JSON.stringify(withCue(stored, "monsterBlock", "c2", T0 + 2000)), T0 + 2100)).toMatchObject({ id: "c2", kind: "monsterBlock" });
  });

  test("mai statistiche di una singola atleta: la scritta pubblica ha solo id, tipo, età e suono", () => {
    const raw = JSON.stringify({ ...withCue(EMPTY_CUES, "monsterBlock", "c1", T0), player: "a1", extra: { name: "Anna" } });
    const cue = publicCueFrom(raw, T0 + 100);
    expect(cue).not.toBeNull();
    expect(Object.keys(cue!).sort()).toEqual(["age", "id", "kind", "sound"]);
    expect(JSON.stringify(cue)).not.toContain("Anna");
  });

  test("un valore rovinato o sconosciuto non ferma niente: vale come vuoto", () => {
    expect(parseCues(null)).toEqual(EMPTY_CUES);
    expect(parseCues("{rotto")).toEqual(EMPTY_CUES);
    expect(parseCues(JSON.stringify({ last: { id: "x", kind: "inventato", at: T0 }, sounds: {} }))).toEqual(EMPTY_CUES);
    expect(publicCueFrom("", T0)).toBeNull();
  });

  test("i suoni caricati: versione per tasto, si tolgono, e i tasti che non esistono si ignorano", () => {
    let stored = withSound(EMPTY_CUES, "ace", T0);
    expect(publicCueSounds(JSON.stringify(stored))).toEqual({ ace: T0 });
    const raw = JSON.stringify(withCue(stored, "ace", "c1", T0 + 10));
    expect(publicCueFrom(raw, T0 + 20)).toMatchObject({ sound: T0 });
    stored = withSound(stored, "ace", null);
    expect(publicCueSounds(JSON.stringify(stored))).toEqual({});
    expect(publicCueSounds(JSON.stringify({ last: null, sounds: { ace: 1, vecchio: 2 } }))).toEqual({ ace: 1 });
    expect(soundUrl("monsterBlock", 123)).toBe("/api/diretta/suono/monsterBlock?v=123");
  });

  test("formati dei file audio: dal tipo dichiarato o dall'estensione, mai altro", () => {
    expect(soundTypeOf({ type: "audio/mpeg", name: "a.bin" })).toBe("audio/mpeg");
    expect(soundTypeOf({ type: "audio/mp3", name: "a.mp3" })).toBe("audio/mpeg");
    expect(soundTypeOf({ type: "", name: "Jingle.M4A" })).toBe("audio/mp4");
    expect(soundTypeOf({ type: "", name: "coro.wav" })).toBe("audio/wav");
    expect(soundTypeOf({ type: "text/html", name: "pagina.html" })).toBeNull();
    expect(soundTypeOf({ type: "", name: "senza-estensione" })).toBeNull();
    expect(parseSound(JSON.stringify({ type: "audio/mpeg", data: "AAAA" }))).toEqual({ type: "audio/mpeg", data: "AAAA" });
    expect(parseSound(JSON.stringify({ type: "text/html", data: "PGgxPg==" }))).toBeNull();
    expect(parseSound("")).toBeNull();
  });

  test("solo il Monster block ha un suono di partenza (un mp3 piccolo in public, con la versione); gli altri tasti sono muti", () => {
    expect(DEFAULT_SOUND_KINDS).toEqual(["monsterBlock"]);
    for (const kind of CUE_KINDS) {
      const path = join(process.cwd(), "public", "diretta", "suoni", `${kind}.mp3`);
      if (kind !== "monsterBlock") {
        expect(defaultSoundUrl(kind)).toBeNull();
        expect(existsSync(path)).toBe(false);
        continue;
      }
      expect(defaultSoundUrl(kind)).toBe(`/diretta/suoni/${kind}.mp3?v=${DEFAULT_SOUNDS_VERSION}`);
      const file = readFileSync(path);
      // Un mp3 vero (sincronismo del primo frame, nessun tag con metadati) e leggero: la grafica li scarica tutti e sei.
      expect([file[0], file[1] & 0xe0]).toEqual([0xff, 0xe0]);
      expect(file.length).toBeGreaterThan(10_000);
      expect(file.length).toBeLessThan(80_000);
    }
  });

  test("il campanello in tempo reale: canale e indirizzo giusti, e solo la chiave pubblica (mai quella del server)", () => {
    expect(CUE_CHANNEL).toBe("pulsantiera");
    expect(CUE_EVENT).toBe("scritta");
    expect(realtimeSocketUrl("https://abc.supabase.co")).toBe("wss://abc.supabase.co/realtime/v1");
    expect(realtimeSocketUrl("https://abc.supabase.co/")).toBe("wss://abc.supabase.co/realtime/v1");
    // La chiave nel browser è quella «publishable»: mai una chiave segreta o di servizio.
    expect(SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")).toBe(true);
    const shared = readFileSync(join(process.cwd(), "src", "lib", "diretta", "realtime.ts"), "utf8");
    expect(shared).not.toMatch(/SERVICE_ROLE|sb_secret_/);
  });
});
