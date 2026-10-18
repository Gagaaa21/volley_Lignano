import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * Cosa succede toccando una notifica, provato eseguendo il vero public/sw.js con un ambiente finto. Un avviso U14/U15 punta a
 * «/»: con il vecchio confronto («l'indirizzo della finestra contiene...») qualunque finestra andava bene, e si tirava in
 * primo piano anche l'app di Minivolley, che sta sotto «/minivolley». U14/U15 e Minivolley sono due cose distinte.
 */

const SITE = "https://sito.example";
const SW = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

type Listener = (event: unknown) => void;

function load() {
  const listeners = new Map<string, Listener>();
  const focused: string[] = [];
  const opened: string[] = [];
  let windows: string[] = [];
  const self = {
    location: { origin: SITE },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async () => windows.map((url) => ({ url, focus: async () => void focused.push(url) })),
      openWindow: async (url: string) => void opened.push(url),
    },
    registration: {},
  };
  vm.runInNewContext(SW, { self, URL, console, Response, fetch: async () => new Response("") });

  async function tap(url: string | undefined, open: string[]) {
    windows = open;
    focused.length = 0;
    opened.length = 0;
    const pending: Promise<unknown>[] = [];
    listeners.get("notificationclick")!({
      notification: { close: () => undefined, data: url === undefined ? undefined : { url } },
      waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
    });
    await Promise.all(pending);
    return { focused: [...focused], opened: [...opened] };
  }

  return { tap };
}

test.describe("toccare una notifica", () => {
  test("un avviso U14/U15 porta in primo piano la finestra di U14/U15, non quella di Minivolley", async () => {
    const { tap } = load();
    expect(await tap("/", [`${SITE}/minivolley`, `${SITE}/`])).toEqual({ focused: [`${SITE}/`], opened: [] });
    // Anche l'area riservata (U14/U15 e Minivolley insieme) va bene per un avviso U14/U15.
    expect(await tap("/", [`${SITE}/minivolley/diretta`, `${SITE}/admin/partite`])).toEqual({ focused: [`${SITE}/admin/partite`], opened: [] });
    // Senza un avviso senza indirizzo vale «/».
    expect(await tap(undefined, [`${SITE}/minivolley`, `${SITE}/`])).toEqual({ focused: [`${SITE}/`], opened: [] });
  });

  test("con aperta solo l'app di Minivolley, l'avviso U14/U15 apre la sua pagina e lascia stare l'altra app", async () => {
    const { tap } = load();
    expect(await tap("/", [`${SITE}/minivolley`])).toEqual({ focused: [], opened: [`${SITE}/`] });
    expect(await tap("/", [])).toEqual({ focused: [], opened: [`${SITE}/`] });
  });

  test("un avviso di Minivolley porta in primo piano una finestra di Minivolley, mai quella di U14/U15", async () => {
    const { tap } = load();
    expect(await tap("/minivolley", [`${SITE}/`, `${SITE}/minivolley`])).toEqual({ focused: [`${SITE}/minivolley`], opened: [] });
    expect(await tap("/minivolley", [`${SITE}/`])).toEqual({ focused: [], opened: [`${SITE}/minivolley`] });
  });

  test("un avviso dell'area riservata vuole la stessa pagina, altrimenti la apre", async () => {
    const { tap } = load();
    const target = "/admin/allenamenti/scheda/abc/2026-10-20";
    expect(await tap(target, [`${SITE}/admin`, `${SITE}${target}?x=1`])).toEqual({ focused: [`${SITE}${target}?x=1`], opened: [] });
    expect(await tap(target, [`${SITE}/admin`, `${SITE}/`])).toEqual({ focused: [], opened: [`${SITE}${target}`] });
  });

  test("finestre di un altro sito non contano", async () => {
    const { tap } = load();
    expect(await tap("/", ["https://altro.example/"])).toEqual({ focused: [], opened: [`${SITE}/`] });
  });

  test("il worker di Minivolley è lo stesso worker, registrato solo per «/minivolley»", () => {
    const s3 = readFileSync(path.join(process.cwd(), "public", "sw-s3.js"), "utf8");
    expect(s3).toContain('importScripts("/sw.js")');
  });
});
