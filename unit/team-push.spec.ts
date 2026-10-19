import { expect, test } from "@playwright/test";
import {
  cleanIosMinivolleyApp,
  deviceSubscriptions,
  endpointService,
  endpointTail,
  existingSubscription,
  hasTeamSubscription,
  healTeams,
  linkStaff,
  LEGACY_PUSH_TEAM_KEY,
  moveLegacySubscription,
  PUSH_SYNC_INTERVAL_MS,
  PUSH_SYNCED_AT_KEY,
  PUSH_TEAMS_KEY,
  rememberedTeams,
  resetDevice,
  subscribeTeam,
  syncPush,
  unsubscribeTeam,
  type PushDeps,
} from "@/lib/pwa/teamPush";

/**
 * Le iscrizioni alle notifiche per squadra, con un browser finto: un worker e un'iscrizione per squadra, e niente che le sposti
 * da una squadra all'altra (né il selettore squadra, né l'accesso all'area riservata).
 */

const PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

interface FakeSubscription {
  endpoint: string;
  toJSON(): { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe(): Promise<boolean>;
}

interface Call {
  method: "POST" | "DELETE";
  body: Record<string, unknown>;
}

function world(options: {
  /** Iscrizioni già presenti, per portata del worker: «/» (U14/U15) e/o «/minivolley». */
  existing?: Record<string, string>;
  storage?: Record<string, string>;
  iosApp?: boolean;
  pathname?: string;
  publicKey?: string | null;
  /** Il sito risponde con un errore alle chiamate che passano da qui. */
  failPost?: boolean;
  /** Pagina aperta da zero (dall'icona), non arrivando da un'altra pagina del sito. */
  coldStart?: boolean;
  /** Registrare questi worker non riesce (il browser lancia un errore). */
  failRegister?: string[];
  now?: number;
}) {
  const registrations = new Map<string, { scope: string; subscription: FakeSubscription | null }>();
  const registered: { script: string; scope: string }[] = [];
  const calls: Call[] = [];
  const errors: { step: string; message: string }[] = [];
  const storage = new Map<string, string>(Object.entries(options.storage ?? {}));
  let counter = 0;

  const addRegistration = (scope: string, existingEndpoint?: string) => {
    const entry: { scope: string; subscription: FakeSubscription | null } = { scope, subscription: null };
    const make = (endpoint: string): FakeSubscription => ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: `p-${endpoint}`, auth: `a-${endpoint}` } }),
      unsubscribe: async () => {
        entry.subscription = null;
        return true;
      },
    });
    if (existingEndpoint) entry.subscription = make(existingEndpoint);
    registrations.set(scope, entry);
    return {
      entry,
      make,
      registration: {
        scope: `https://sito.example${scope}`,
        active: {},
        installing: null,
        waiting: null,
        pushManager: {
          getSubscription: async () => entry.subscription,
          subscribe: async () => {
            entry.subscription ??= make(`https://push.example/${scope === "/" ? "root" : scope.slice(1)}-${++counter}`);
            return entry.subscription;
          },
        },
      } as unknown as ServiceWorkerRegistration,
    };
  };

  const wrappers = new Map<string, ReturnType<typeof addRegistration>>();
  for (const [scope, endpoint] of Object.entries(options.existing ?? {})) wrappers.set(scope, addRegistration(scope, endpoint));

  const deps: PushDeps = {
    serviceWorker: {
      register: async (script, { scope }) => {
        if (options.failRegister?.includes(script)) throw new Error(`registrazione di ${script} non riuscita`);
        registered.push({ script, scope });
        if (!wrappers.has(scope)) wrappers.set(scope, addRegistration(scope));
        return wrappers.get(scope)!.registration;
      },
      // Come il browser: vince la portata più lunga che copre l'indirizzo («/» copre anche «/minivolley»).
      getRegistration: async (clientURL) => {
        const matching = [...wrappers.keys()]
          .filter((scope) => scope === "/" || clientURL === scope || clientURL.startsWith(`${scope}/`))
          .sort((a, b) => b.length - a.length);
        return matching.length ? wrappers.get(matching[0])!.registration : undefined;
      },
    },
    storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => void storage.set(key, value) },
    send: async (method, body) => {
      calls.push({ method, body });
      return !options.failPost;
    },
    publicKey: options.publicKey === null ? undefined : (options.publicKey ?? PUBLIC_KEY),
    now: () => options.now ?? 1_800_000_000_000,
    iosApp: options.iosApp ?? false,
    pathname: options.pathname ?? "/",
    coldStart: options.coldStart ?? true,
    report: (step, error) => void errors.push({ step, message: error instanceof Error ? error.message : String(error) }),
  };

  return {
    deps,
    calls,
    errors,
    registered,
    storage,
    subscriptionAt: (scope: string) => registrations.get(scope)?.subscription ?? null,
    hasWorker: (scope: string) => registrations.has(scope),
  };
}

test.describe("un'iscrizione per squadra", () => {
  test("ogni squadra ha il suo worker e la sua iscrizione, distinte", async () => {
    const w = world({});
    expect(await subscribeTeam(w.deps, "u14u15")).toBe(true);
    expect(await subscribeTeam(w.deps, "minivolley")).toBe(true);

    expect(w.registered).toEqual([
      { script: "/sw.js", scope: "/" },
      { script: "/sw-s3.js", scope: "/minivolley" },
    ]);
    const posts = w.calls.filter((call) => call.method === "POST");
    expect(posts.map((call) => call.body.team)).toEqual(["u14u15", "minivolley"]);
    expect(posts[0].body.endpoint).not.toEqual(posts[1].body.endpoint);
    expect(rememberedTeams(w.deps)).toEqual(["u14u15", "minivolley"]);
  });

  test("senza la chiave pubblica non si iscrive a niente", async () => {
    const w = world({ publicKey: null });
    expect(await subscribeTeam(w.deps, "minivolley")).toBe(false);
    expect(w.registered).toEqual([]);
    await syncPush(w.deps, { admin: true });
    expect(w.calls).toEqual([]);
  });

  test("se il sito non registra l'iscrizione la squadra non risulta attiva", async () => {
    const w = world({ failPost: true });
    expect(await subscribeTeam(w.deps, "minivolley")).toBe(false);
    expect(rememberedTeams(w.deps)).toEqual([]);
  });

  test("per sapere se una squadra è attiva non si registra niente, e il worker di «/» non è quello di Minivolley", async () => {
    const w = world({ existing: { "/": "https://push.example/vecchia" } });
    expect(await hasTeamSubscription(w.deps, "u14u15")).toBe(true);
    // «/minivolley» è coperto anche dal worker di «/»: ma l'iscrizione di Minivolley è un'altra cosa, e qui non c'è.
    expect(await hasTeamSubscription(w.deps, "minivolley")).toBe(false);
    expect(await existingSubscription(w.deps, "minivolley")).toBeNull();
    expect(w.registered).toEqual([]);
  });
});

test.describe("area riservata", () => {
  test("associa l'account alle iscrizioni che ci sono, senza crearne né spostarne: il selettore squadra non conta", async () => {
    // Un dispositivo che segue solo U14/U15: entrare nell'area riservata (con qualunque squadra scelta) non lo fa seguire Minivolley.
    const w = world({ existing: { "/": "https://push.example/u14" }, storage: { [PUSH_TEAMS_KEY]: '["u14u15"]' } });
    await syncPush(w.deps, { admin: true });

    expect(w.registered).toEqual([]);
    expect(w.hasWorker("/minivolley")).toBe(false);
    expect(w.calls).toEqual([
      {
        method: "POST",
        body: { endpoint: "https://push.example/u14", keys: { p256dh: "p-https://push.example/u14", auth: "a-https://push.example/u14" }, team: "u14u15", linkStaff: true },
      },
    ]);
  });

  test("con tutte e due le iscrizioni le associa tutte e due, ognuna con la sua squadra", async () => {
    const w = world({ existing: { "/": "https://push.example/u14", "/minivolley": "https://push.example/s3" } });
    await linkStaff(w.deps);
    expect(w.calls.map((call) => [call.body.endpoint, call.body.team, call.body.linkStaff])).toEqual([
      ["https://push.example/u14", "u14u15", true],
      ["https://push.example/s3", "minivolley", true],
    ]);
  });

  test("senza iscrizioni non c'è niente da associare", async () => {
    const w = world({});
    await linkStaff(w.deps);
    expect(w.calls).toEqual([]);
    expect(w.registered).toEqual([]);
  });
});

test.describe("iscrizioni cancellate dal browser e controllo periodico", () => {
  test("si rifà l'iscrizione cancellata, per la squadra giusta", async () => {
    const w = world({ storage: { [PUSH_TEAMS_KEY]: '["minivolley"]' } });
    await healTeams(w.deps, { refresh: true });
    expect(w.registered).toEqual([{ script: "/sw-s3.js", scope: "/minivolley" }]);
    expect(w.calls.map((call) => [call.method, call.body.team])).toEqual([["POST", "minivolley"]]);
  });

  test("quelle che ci sono si rinnovano sul sito senza cambiare squadra", async () => {
    const w = world({ existing: { "/": "https://push.example/u14" }, storage: { [PUSH_TEAMS_KEY]: '["u14u15"]' } });
    await healTeams(w.deps, { refresh: true });
    expect(w.calls).toHaveLength(1);
    expect(w.calls[0].body).toMatchObject({ endpoint: "https://push.example/u14", team: "u14u15", refresh: true });
    expect(w.registered).toEqual([]);
  });

  test("fuori dall'area riservata il controllo è al massimo una volta al giorno", async () => {
    const now = 1_800_000_000_000;
    const recent = world({
      existing: { "/": "https://push.example/u14" },
      storage: { [PUSH_TEAMS_KEY]: '["u14u15"]', [PUSH_SYNCED_AT_KEY]: String(now - 1000), "vl-pwa-push-v2": "1" },
      now,
    });
    await syncPush(recent.deps, { admin: false });
    expect(recent.calls).toEqual([]);

    const old = world({
      existing: { "/": "https://push.example/u14" },
      storage: { [PUSH_TEAMS_KEY]: '["u14u15"]', [PUSH_SYNCED_AT_KEY]: String(now - PUSH_SYNC_INTERVAL_MS - 1), "vl-pwa-push-v2": "1" },
      now,
    });
    await syncPush(old.deps, { admin: false });
    expect(old.calls).toHaveLength(1);
    expect(old.storage.get(PUSH_SYNCED_AT_KEY)).toBe(String(now));
  });

  test("l'elenco vecchio (una squadra sola) si legge ancora", () => {
    const w = world({ storage: { [LEGACY_PUSH_TEAM_KEY]: "minivolley" } });
    expect(rememberedTeams(w.deps)).toEqual(["minivolley"]);
    const broken = world({ storage: { [PUSH_TEAMS_KEY]: "non è json", [LEGACY_PUSH_TEAM_KEY]: "u14u15" } });
    expect(rememberedTeams(broken.deps)).toEqual(["u14u15"]);
  });
});

test.describe("iscrizioni di prima (una sola per browser, sul worker di «/»)", () => {
  test("chi seguiva Minivolley passa al worker di Minivolley e libera quello di «/»", async () => {
    const w = world({ existing: { "/": "https://push.example/vecchia" }, storage: { [LEGACY_PUSH_TEAM_KEY]: "minivolley" } });
    await moveLegacySubscription(w.deps);

    expect(w.registered).toEqual([{ script: "/sw-s3.js", scope: "/minivolley" }]);
    expect(w.calls.map((call) => [call.method, call.body.team ?? call.body.endpoint])).toEqual([
      ["POST", "minivolley"],
      ["DELETE", "https://push.example/vecchia"],
    ]);
    expect(w.subscriptionAt("/")).toBeNull();
    expect(w.subscriptionAt("/minivolley")).not.toBeNull();
    expect(rememberedTeams(w.deps)).toEqual(["minivolley"]);

    // Una volta sola.
    const before = w.calls.length;
    await moveLegacySubscription(w.deps);
    expect(w.calls).toHaveLength(before);
  });

  test("se il sito non risponde l'iscrizione di prima resta dov'è e si riprova alla visita dopo", async () => {
    const w = world({ existing: { "/": "https://push.example/vecchia" }, storage: { [LEGACY_PUSH_TEAM_KEY]: "minivolley" }, failPost: true });
    await moveLegacySubscription(w.deps);
    expect(w.subscriptionAt("/")).not.toBeNull();
    expect(w.calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(w.storage.get("vl-pwa-push-v2")).toBeUndefined();
  });

  test("chi seguiva U14/U15 resta dov'è", async () => {
    const w = world({ existing: { "/": "https://push.example/vecchia" }, storage: { [LEGACY_PUSH_TEAM_KEY]: "u14u15" } });
    await moveLegacySubscription(w.deps);
    expect(w.calls).toEqual([]);
    expect(w.subscriptionAt("/")).not.toBeNull();
    expect(rememberedTeams(w.deps)).toEqual(["u14u15"]);
  });

  test("alla primissima visita (nessun worker ancora registrato) non si dà per fatta la sistemazione", async () => {
    const w = world({ storage: { [LEGACY_PUSH_TEAM_KEY]: "minivolley" } });
    await moveLegacySubscription(w.deps);
    expect(w.storage.get("vl-pwa-push-v2")).toBeUndefined();
    expect(w.calls).toEqual([]);
  });

  test("Minivolley senza più l'iscrizione (cancellata dal browser) si rifà sul suo worker", async () => {
    const w = world({ storage: { [LEGACY_PUSH_TEAM_KEY]: "minivolley" } });
    await syncPush(w.deps, { admin: false });
    expect(w.registered).toEqual([{ script: "/sw-s3.js", scope: "/minivolley" }]);
    expect(w.calls.map((call) => call.body.team)).toEqual(["minivolley"]);
  });
});

test.describe("app di Minivolley su iPhone o iPad", () => {
  test("l'iscrizione U14/U15 che il selettore le aveva dato si toglie, e al suo posto c'è quella di Minivolley", async () => {
    const w = world({
      existing: { "/": "https://push.example/sbagliata" },
      storage: { [LEGACY_PUSH_TEAM_KEY]: "u14u15", "vl-pwa-push-v2": "1", [PUSH_TEAMS_KEY]: '["u14u15"]' },
      iosApp: true,
      pathname: "/minivolley",
    });
    await cleanIosMinivolleyApp(w.deps);

    expect(w.storage.get("vl-pwa-app-team")).toBe("minivolley");
    expect(w.calls.map((call) => [call.method, call.body.team ?? call.body.endpoint])).toEqual([
      ["POST", "minivolley"],
      ["DELETE", "https://push.example/sbagliata"],
    ]);
    expect(w.subscriptionAt("/")).toBeNull();
    expect(rememberedTeams(w.deps)).toEqual(["minivolley"]);

    // Una volta sola: se poi si attivano di nuovo le notifiche di U14/U15 da qui, restano.
    await subscribeTeam(w.deps, "u14u15");
    const before = w.calls.length;
    await cleanIosMinivolleyApp(w.deps);
    expect(w.calls).toHaveLength(before);
    expect(w.subscriptionAt("/")).not.toBeNull();
  });

  test("l'app di U14/U15, un browser qualsiasi e un'app aperta da una pagina qualunque non si toccano", async () => {
    const root = { "/": "https://push.example/u14" };
    const u14App = world({ existing: root, iosApp: true, pathname: "/" });
    await cleanIosMinivolleyApp(u14App.deps);
    expect(u14App.storage.get("vl-pwa-app-team")).toBe("u14u15");
    expect(u14App.calls).toEqual([]);

    const browser = world({ existing: root, iosApp: false, pathname: "/minivolley" });
    await cleanIosMinivolleyApp(browser.deps);
    expect(browser.storage.get("vl-pwa-app-team")).toBeUndefined();
    expect(browser.calls).toEqual([]);

    const unknown = world({ existing: root, iosApp: true, pathname: "/admin/partite" });
    await cleanIosMinivolleyApp(unknown.deps);
    expect(unknown.storage.get("vl-pwa-app-team")).toBeUndefined();
    expect(unknown.calls).toEqual([]);
  });

  test("senza il worker di «/» ancora registrato non si dà per fatta la pulizia", async () => {
    const w = world({ iosApp: true, pathname: "/minivolley" });
    await cleanIosMinivolleyApp(w.deps);
    expect(w.storage.get("vl-pwa-app-team")).toBe("minivolley");
    expect(w.storage.get("vl-pwa-push-ios-cleaned")).toBeUndefined();
  });

  test("se l'iscrizione di Minivolley non si riesce a fare, quella di prima resta e si riprova", async () => {
    const w = world({ existing: { "/": "https://push.example/sbagliata" }, iosApp: true, pathname: "/minivolley", failPost: true });
    await cleanIosMinivolleyApp(w.deps);
    expect(w.subscriptionAt("/")).not.toBeNull();
    expect(w.storage.get("vl-pwa-push-ios-cleaned")).toBeUndefined();
  });
});

test.describe("ogni passo per conto suo", () => {
  test("se la sistemazione delle iscrizioni di prima non riesce, il resto va avanti e l'errore si annota", async () => {
    const w = world({
      existing: { "/": "https://push.example/vecchia" },
      storage: { [LEGACY_PUSH_TEAM_KEY]: "minivolley" },
      failRegister: ["/sw-s3.js"],
    });
    await syncPush(w.deps, { admin: true });

    // Falliscono i due passi che hanno bisogno del worker di Minivolley; ognuno si annota, e l'ultimo (account) parte lo stesso.
    expect(w.errors.map((error) => error.step)).toEqual(["iscrizioni di prima", "iscrizioni cancellate dal browser"]);
    expect(w.errors[0].message).toContain("/sw-s3.js");
    // L'iscrizione di prima resta com'è (non è stata tolta) e l'account dello staff si collega lo stesso.
    expect(w.subscriptionAt("/")).not.toBeNull();
    expect(w.calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(w.calls.some((call) => call.body.linkStaff === true)).toBe(true);
    expect(w.storage.get("vl-pwa-push-v2")).toBeUndefined();
  });

  test("anche la pulizia dell'app di Minivolley va avanti se un altro passo ha fallito", async () => {
    const w = world({
      existing: { "/": "https://push.example/sbagliata" },
      storage: { [LEGACY_PUSH_TEAM_KEY]: "u14u15" },
      iosApp: true,
      pathname: "/minivolley",
    });
    await syncPush(w.deps, { admin: false });
    expect(w.errors).toEqual([]);
    expect(w.subscriptionAt("/")).toBeNull();
    expect(w.subscriptionAt("/minivolley")).not.toBeNull();
  });
});

test.describe("di che squadra è l'app (iPhone e iPad)", () => {
  const appRoot = { "/": "https://push.example/root" };

  test("l'app aperta da zero dalla sua pagina iniziale corregge quello che si ricordava (anche se la prima volta era partita dall'altra)", async () => {
    // Prima volta partita da «/»: ricordata come app di U14/U15, ma ora si apre da zero «/minivolley».
    const w = world({ existing: appRoot, storage: { "vl-pwa-app-team": "u14u15", "vl-pwa-push-v2": "1" }, iosApp: true, pathname: "/minivolley", coldStart: true });
    await cleanIosMinivolleyApp(w.deps);
    expect(w.storage.get("vl-pwa-app-team")).toBe("minivolley");
    expect(w.subscriptionAt("/")).toBeNull();
    expect(w.subscriptionAt("/minivolley")).not.toBeNull();
  });

  test("arrivare a una pagina di Minivolley da un link, in un'app ricordata come U14/U15, non la cambia", async () => {
    const w = world({ existing: appRoot, storage: { "vl-pwa-app-team": "u14u15", "vl-pwa-push-v2": "1" }, iosApp: true, pathname: "/minivolley", coldStart: false });
    await cleanIosMinivolleyApp(w.deps);
    expect(w.storage.get("vl-pwa-app-team")).toBe("u14u15");
    expect(w.calls).toEqual([]);
    expect(w.subscriptionAt("/")).not.toBeNull();
  });

  test("una pagina qualunque, aperta da zero, non dice di che squadra è l'app", async () => {
    const w = world({ existing: appRoot, storage: { "vl-pwa-app-team": "minivolley", "vl-pwa-push-v2": "1" }, iosApp: true, pathname: "/minivolley/presenze", coldStart: true });
    await cleanIosMinivolleyApp(w.deps);
    // Resta quello ricordato: l'app è di Minivolley, e la pulizia fa il suo corso.
    expect(w.storage.get("vl-pwa-app-team")).toBe("minivolley");
    expect(w.subscriptionAt("/")).toBeNull();
  });
});

test.describe("gestione delle notifiche di questo dispositivo", () => {
  test("si vede cosa ha il dispositivo, squadra per squadra", async () => {
    const w = world({ existing: { "/": "https://push.example/u14", "/minivolley": "https://push.example/s3" } });
    const found = await deviceSubscriptions(w.deps);
    expect(found.u14u15?.endpoint).toBe("https://push.example/u14");
    expect(found.minivolley?.endpoint).toBe("https://push.example/s3");
    const onlyRoot = world({ existing: { "/": "https://push.example/u14" } });
    const partial = await deviceSubscriptions(onlyRoot.deps);
    expect(partial.u14u15).not.toBeNull();
    expect(partial.minivolley).toBeNull();
  });

  test("si toglie una squadra sola: iscrizione e riga sul sito, e l'altra resta", async () => {
    const w = world({
      existing: { "/": "https://push.example/u14", "/minivolley": "https://push.example/s3" },
      storage: { [PUSH_TEAMS_KEY]: '["u14u15","minivolley"]' },
    });
    expect(await unsubscribeTeam(w.deps, "minivolley")).toBe(true);
    expect(w.subscriptionAt("/minivolley")).toBeNull();
    expect(w.subscriptionAt("/")).not.toBeNull();
    expect(w.calls).toEqual([{ method: "DELETE", body: { endpoint: "https://push.example/s3" } }]);
    expect(rememberedTeams(w.deps)).toEqual(["u14u15"]);
    // Una squadra che non c'è: niente da togliere.
    expect(await unsubscribeTeam(w.deps, "minivolley")).toBe(false);
  });

  test("«rimetti a posto tutto» toglie tutte e due e da lì in poi la sistemazione automatica non riporta indietro niente", async () => {
    const w = world({
      existing: { "/": "https://push.example/u14", "/minivolley": "https://push.example/s3" },
      storage: { [LEGACY_PUSH_TEAM_KEY]: "minivolley" },
      iosApp: true,
      pathname: "/minivolley",
    });
    expect(await resetDevice(w.deps)).toBe(2);
    expect(w.subscriptionAt("/")).toBeNull();
    expect(w.subscriptionAt("/minivolley")).toBeNull();
    expect(rememberedTeams(w.deps)).toEqual([]);
    expect(w.calls.filter((call) => call.method === "DELETE").map((call) => call.body.endpoint).sort()).toEqual([
      "https://push.example/s3",
      "https://push.example/u14",
    ]);
    // Aprire di nuovo il sito non fa tornare niente.
    const before = w.calls.length;
    await syncPush(w.deps, { admin: false });
    expect(w.calls).toHaveLength(before);
    expect(w.subscriptionAt("/")).toBeNull();
  });

  test("il servizio e la fine dell'indirizzo si leggono a parole", () => {
    expect(endpointService("https://web.push.apple.com/QOLb3x")).toContain("Apple");
    expect(endpointService("https://fcm.googleapis.com/fcm/send/abc")).toContain("Google");
    expect(endpointService("https://updates.push.services.mozilla.com/wpush/v2/x")).toContain("Mozilla");
    expect(endpointService("https://wns2-par02p.notify.windows.com/w/?token=x")).toContain("Microsoft");
    expect(endpointService("non è un indirizzo")).toBe("sconosciuto");
    expect(endpointTail("https://push.example/abcdefgh")).toBe("abcdefgh".slice(-6));
  });
});
