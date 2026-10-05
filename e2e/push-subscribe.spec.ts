import { expect, test } from "@playwright/test";
import { loginAsDev } from "./helpers";

/**
 * Iscrizioni alle notifiche: il rinnovo silenzioso (browser che cambia
 * indirizzo o controllo periodico) non deve spostare nessuno da una squadra
 * all'altra né perdere l'iscrizione. Si prova sull'API, leggendo i conteggi
 * per squadra che il Centro di controllo mostra sopra l'invio manuale.
 * Alla fine lo spec toglie le iscrizioni di prova.
 */
const KEYS = { p256dh: "BE2E-chiave-p256dh", auth: "e2e-auth" };

async function subscribe(request: import("@playwright/test").APIRequestContext, body: Record<string, unknown>) {
  const response = await request.post("/api/push/subscribe", { data: body });
  expect(response.ok()).toBe(true);
}

test("rinnovo e cambio di indirizzo mantengono la squadra", async ({ page }) => {
  await loginAsDev(page);
  const counts = async () => {
    await page.goto("/admin/centro-controllo");
    const u1415 = await page.getByText(/Tutti U14\/U15 \((\d+)\)/).textContent();
    const mini = await page.getByText(/Tutti Minivolley \((\d+)\)/).textContent();
    return {
      u14u15: Number(/\((\d+)\)/.exec(u1415 ?? "")?.[1]),
      minivolley: Number(/\((\d+)\)/.exec(mini ?? "")?.[1]),
    };
  };

  const before = await counts();

  // 1. Nuova iscrizione dal sito Minivolley.
  await subscribe(page.request, { endpoint: "https://push.example/e2e-1", keys: KEYS, team: "minivolley" });
  expect(await counts()).toEqual({ u14u15: before.u14u15, minivolley: before.minivolley + 1 });

  // 2. Rinnovo silenzioso fatto da una pagina U14/U15: la squadra resta Minivolley.
  await subscribe(page.request, {
    endpoint: "https://push.example/e2e-1",
    keys: { ...KEYS, auth: "e2e-auth-nuova" },
    team: "u14u15",
    refresh: true,
  });
  expect(await counts()).toEqual({ u14u15: before.u14u15, minivolley: before.minivolley + 1 });

  // 3. Il browser cambia indirizzo (pushsubscriptionchange): l'iscrizione si sposta, squadra invariata, nessun doppione.
  await subscribe(page.request, {
    endpoint: "https://push.example/e2e-2",
    keys: KEYS,
    oldEndpoint: "https://push.example/e2e-1",
    refresh: true,
  });
  expect(await counts()).toEqual({ u14u15: before.u14u15, minivolley: before.minivolley + 1 });

  // 4. Un rinnovo per un indirizzo sconosciuto è una iscrizione nuova, con la squadra indicata.
  await subscribe(page.request, {
    endpoint: "https://push.example/e2e-3",
    keys: KEYS,
    team: "u14u15",
    refresh: true,
  });
  expect(await counts()).toEqual({ u14u15: before.u14u15 + 1, minivolley: before.minivolley + 1 });

  // Pulizia.
  for (const endpoint of ["https://push.example/e2e-2", "https://push.example/e2e-3"]) {
    const response = await page.request.delete("/api/push/subscribe", { data: { endpoint } });
    expect(response.ok()).toBe(true);
  }
  expect(await counts()).toEqual(before);
});
