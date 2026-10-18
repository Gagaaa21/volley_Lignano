import { expect, test, type Page } from "@playwright/test";
import { dismissTourIfShown, loginAsDev, switchTeam, uniqueName } from "./helpers";

/**
 * Notifiche per squadra: U14/U15 e Minivolley sono due cose distinte, anche sullo stesso dispositivo. Ogni squadra ha il suo
 * service worker (e quindi la sua iscrizione): «/sw.js» per U14/U15 e «/sw-s3.js» per Minivolley. Si prova nel browser vero,
 * con i service worker veri, ma con un finto servizio push (quello vero passa da Google o Apple): l'iscrizione, una per
 * worker, si tiene in localStorage, così sopravvive ai ricaricamenti come in un browser vero. Le iscrizioni del sito si
 * leggono dai conteggi per squadra del Centro di controllo. Alla fine lo spec toglie le iscrizioni di prova.
 */
const KEYS = { p256dh: "BE2E-chiave-p256dh", auth: "e2e-auth" };
const FAKE_PUSH_KEY = "e2e-fake-push";

/** Gira nel browser prima di ogni pagina: sostituisce il gestore push dei service worker con uno finto, uno per portata. */
function installFakePush(seed: Record<string, string>) {
  const KEY = "e2e-fake-push";
  if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, JSON.stringify(seed));
  const load = (): Record<string, string> => JSON.parse(localStorage.getItem(KEY) ?? "{}");
  const save = (value: Record<string, string>) => localStorage.setItem(KEY, JSON.stringify(value));
  const scopeOf = (registration: ServiceWorkerRegistration) => new URL(registration.scope).pathname;
  const makeManager = (registration: ServiceWorkerRegistration) => {
    const make = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: `k-${endpoint}`, auth: `a-${endpoint}` } }),
      unsubscribe: async () => {
        const all = load();
        delete all[scopeOf(registration)];
        save(all);
        return true;
      },
    });
    return {
      getSubscription: async () => {
        const endpoint = load()[scopeOf(registration)];
        return endpoint ? make(endpoint) : null;
      },
      subscribe: async () => {
        const all = load();
        const scope = scopeOf(registration);
        if (!all[scope]) {
          all[scope] = `https://push.example/e2e-${scope.replace(/\W/g, "") || "root"}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
          save(all);
        }
        return make(all[scope]);
      },
    };
  };
  const managers = new WeakMap<object, unknown>();
  Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", {
    configurable: true,
    get(this: ServiceWorkerRegistration) {
      if (!managers.has(this)) managers.set(this, makeManager(this));
      return managers.get(this);
    },
  });
}

const fakeSubscriptions = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>, FAKE_PUSH_KEY);

async function counts(page: Page) {
  await page.goto("/admin/centro-controllo");
  const u1415 = await page.getByText(/Tutti U14\/U15 \((\d+)\)/).textContent();
  const mini = await page.getByText(/Tutti Minivolley \((\d+)\)/).textContent();
  return {
    u14u15: Number(/\((\d+)\)/.exec(u1415 ?? "")?.[1]),
    minivolley: Number(/\((\d+)\)/.exec(mini ?? "")?.[1]),
  };
}

/** Registra i service worker veri (e aspetta che siano attivi): un'iscrizione c'è solo dove c'è il suo worker. */
async function registerWorkers(page: Page, scopes: ("/" | "/minivolley")[]) {
  await page.evaluate(async (list) => {
    for (const scope of list) {
      const registration = await navigator.serviceWorker.register(scope === "/" ? "/sw.js" : "/sw-s3.js", { scope });
      const worker = registration.installing ?? registration.waiting ?? registration.active;
      if (worker && worker.state !== "activated") {
        await new Promise<void>((resolve) => worker.addEventListener("statechange", () => worker.state === "activated" && resolve()));
      }
    }
  }, scopes);
}

async function addRow(page: Page, endpoint: string, team: "u14u15" | "minivolley") {
  const response = await page.request.post("/api/push/subscribe", { data: { endpoint, keys: KEYS, team } });
  expect(response.ok()).toBe(true);
}

async function removeRows(page: Page, endpoints: string[]) {
  for (const endpoint of endpoints) await page.request.delete("/api/push/subscribe", { data: { endpoint } });
}

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

test("sul sito di Minivolley, con il permesso già dato ma senza la sua iscrizione, si invita ad attivarla; quella di U14/U15 resta com'è", async ({ page }) => {
  test.setTimeout(150_000);
  const u14 = `https://push.example/${uniqueName("u14-")}`;
  await loginAsDev(page);
  await addRow(page, u14, "u14u15");
  const before = await counts(page);
  // Da qui in poi il dispositivo ha già l'iscrizione di U14/U15 (finta, sul worker di «/»).
  await page.addInitScript(installFakePush, { "/": u14 });

  // Il permesso c'è (dato da U14/U15) ma Minivolley non ha la sua iscrizione: la sua pagina lo propone.
  await page.goto("/minivolley");
  await dismissTourIfShown(page);
  const invite = page.getByText("Attiva le notifiche", { exact: true });
  await expect(invite).toBeVisible();
  await page.getByRole("button", { name: "Attiva", exact: true }).click();
  await expect(invite).toBeHidden();

  // Adesso Minivolley ha la sua iscrizione, sul suo worker, e quella di U14/U15 non si è mossa.
  const fake = await fakeSubscriptions(page);
  expect(Object.keys(fake).sort()).toEqual(["/", "/minivolley"]);
  expect(fake["/"]).toBe(u14);
  expect(await counts(page)).toEqual({ u14u15: before.u14u15, minivolley: before.minivolley + 1 });

  // L'invito non torna, né su Minivolley né su U14/U15.
  await page.goto("/minivolley");
  await page.goto("/");
  await expect(page.getByText("Attiva le notifiche", { exact: true })).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(page.getByText("Attiva le notifiche", { exact: true })).toHaveCount(0);

  await removeRows(page, [u14, fake["/minivolley"]]);
});

test("sul sito di U14/U15 chi segue solo Minivolley viene invitato ad attivare U14/U15, e Minivolley non si tocca", async ({ page }) => {
  test.setTimeout(150_000);
  const s3 = `https://push.example/${uniqueName("s3-")}`;
  await loginAsDev(page);
  await addRow(page, s3, "minivolley");
  await registerWorkers(page, ["/minivolley"]);
  const before = await counts(page);
  await page.addInitScript(installFakePush, { "/minivolley": s3 });

  await page.goto("/");
  await dismissTourIfShown(page);
  await expect(page.getByText("Attiva le notifiche", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Attiva", exact: true }).click();
  await expect(page.getByText("Attiva le notifiche", { exact: true })).toBeHidden();

  const fake = await fakeSubscriptions(page);
  expect(Object.keys(fake).sort()).toEqual(["/", "/minivolley"]);
  expect(fake["/minivolley"]).toBe(s3);
  expect(await counts(page)).toEqual({ u14u15: before.u14u15 + 1, minivolley: before.minivolley });

  await removeRows(page, [s3, fake["/"]]);
});

test("area riservata: il selettore squadra non sposta né crea iscrizioni; si collega solo l'account", async ({ page }) => {
  test.setTimeout(180_000);
  const u14 = `https://push.example/${uniqueName("u14-")}`;
  const s3 = `https://push.example/${uniqueName("s3-")}`;
  await loginAsDev(page);
  await addRow(page, u14, "u14u15");
  await addRow(page, s3, "minivolley");
  await registerWorkers(page, ["/", "/minivolley"]);
  const before = await counts(page);
  // Da qui in poi il dispositivo ha le due iscrizioni (finte), una per worker.
  await page.addInitScript(installFakePush, { "/": u14, "/minivolley": s3 });

  const sent: { endpoint?: string; team?: string; linkStaff?: boolean; refresh?: boolean }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/push/subscribe")) sent.push(request.postDataJSON());
  });

  // Il selettore su Minivolley e di nuovo su U14/U15: ogni cambio è un caricamento vero dell'area riservata.
  await switchTeam(page, "minivolley");
  await page.waitForTimeout(1500);
  // Con Minivolley scelto nel selettore niente si sposta: prima l'iscrizione di U14/U15 diventava di Minivolley.
  expect(await counts(page)).toEqual(before);
  await switchTeam(page, "u14u15");
  await page.waitForTimeout(1500);
  expect(await counts(page)).toEqual(before);
  expect(await fakeSubscriptions(page)).toEqual({ "/": u14, "/minivolley": s3 });

  // Sono partite solo le associazioni dell'account (una per iscrizione, con la squadra di ciascuna): mai una squadra cambiata.
  expect(sent.length).toBeGreaterThan(0);
  for (const body of sent) {
    expect(body.team).toBe(body.endpoint === u14 ? "u14u15" : "minivolley");
    expect(body.linkStaff === true || body.refresh === true).toBe(true);
  }
  expect(new Set(sent.filter((body) => body.linkStaff).map((body) => body.endpoint))).toEqual(new Set([u14, s3]));

  await removeRows(page, [u14, s3]);
});

test("chi seguiva Minivolley con l'iscrizione di prima passa al worker di Minivolley, e quello di «/» torna libero", async ({ page }) => {
  test.setTimeout(150_000);
  const old = `https://push.example/${uniqueName("vecchia-")}`;
  await loginAsDev(page);
  const base = await counts(page);
  // Com'era prima: una sola iscrizione per browser, sul worker di «/», con la squadra scelta di volta in volta (qui Minivolley).
  await addRow(page, old, "minivolley");
  const before = { u14u15: base.u14u15, minivolley: base.minivolley + 1 };
  await page.addInitScript(installFakePush, { "/": old });
  await page.addInitScript(() => {
    try {
      // Stato di un browser che apre per la prima volta la versione nuova: la squadra di prima c'è, la sistemazione non è fatta.
      if (localStorage.getItem("e2e-legacy-seeded") === null) {
        localStorage.setItem("e2e-legacy-seeded", "1");
        localStorage.setItem("vl-pwa-push-team", "minivolley");
        localStorage.removeItem("vl-pwa-push-v2");
        localStorage.removeItem("vl-pwa-push-teams");
      }
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });

  await page.goto("/minivolley");
  await expect.poll(async () => Object.keys(await fakeSubscriptions(page)).sort(), { timeout: 30_000 }).toEqual(["/minivolley"]);
  const fake = await fakeSubscriptions(page);

  // Minivolley segue ancora Minivolley (una iscrizione tolta, una nuova), e U14/U15 non ha guadagnato niente.
  expect(fake["/minivolley"]).not.toBe(old);
  expect(await counts(page)).toEqual(before);

  await removeRows(page, [old, fake["/minivolley"]]);
});
