import { expect, type Page } from "@playwright/test";

/**
 * Un finto servizio push per le prove delle notifiche: il vero passa da Google o Apple e qui non c'è. I service worker sono
 * quelli veri; cambia solo il gestore push di ogni registrazione (una iscrizione per portata, tenuta in localStorage così
 * sopravvive ai ricaricamenti come in un browser vero). Le iscrizioni del sito si leggono dai conteggi per squadra del
 * Centro di controllo.
 */
export const KEYS = { p256dh: "BE2E-chiave-p256dh", auth: "e2e-auth" };
export const FAKE_PUSH_KEY = "e2e-fake-push";

/** Gira nel browser prima di ogni pagina: sostituisce il gestore push dei service worker con uno finto, uno per portata. */
export function installFakePush(seed: Record<string, string>) {
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

export const fakeSubscriptions = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>, FAKE_PUSH_KEY);

export async function counts(page: Page) {
  await page.goto("/admin/centro-controllo");
  const u1415 = await page.getByText(/Tutti U14\/U15 \((\d+)\)/).textContent();
  const mini = await page.getByText(/Tutti Minivolley \((\d+)\)/).textContent();
  return {
    u14u15: Number(/\((\d+)\)/.exec(u1415 ?? "")?.[1]),
    minivolley: Number(/\((\d+)\)/.exec(mini ?? "")?.[1]),
  };
}

/** Registra i service worker veri (e aspetta che siano attivi): un'iscrizione c'è solo dove c'è il suo worker. */
export async function registerWorkers(page: Page, scopes: ("/" | "/minivolley")[]) {
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

export async function addRow(page: Page, endpoint: string, team: "u14u15" | "minivolley") {
  const response = await page.request.post("/api/push/subscribe", { data: { endpoint, keys: KEYS, team } });
  expect(response.ok()).toBe(true);
}

export async function removeRows(page: Page, endpoints: string[]) {
  for (const endpoint of endpoints) await page.request.delete("/api/push/subscribe", { data: { endpoint } });
}
