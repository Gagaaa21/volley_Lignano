import { expect, test } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * La guida è un indice, non un muro di testo: le sezioni stanno chiuse, con il titolo e una riga su cosa dicono; si apre quella che
 * serve (o tutte), si cerca una parola (restano le sezioni che ne parlano, già aperte) e un indirizzo con `#sezione` apre quella sezione.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
});

const section = (page: import("@playwright/test").Page, id: string) => page.locator(`[data-guide-section="${id}"]`);
const header = (page: import("@playwright/test").Page, id: string) => section(page, id).locator("button[aria-expanded]").first();

test("guida: sezioni chiuse, si aprono una per una o tutte; la ricerca tiene solo quelle che ne parlano", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/guida");
  await page.waitForLoadState("networkidle");

  // Chiuse: si vede l'elenco con una riga per sezione.
  await expect(header(page, "guida-partite")).toHaveAttribute("aria-expanded", "false");
  await expect(section(page, "guida-partite").locator("ul")).toBeHidden();

  // Un tocco apre quella che serve.
  await header(page, "guida-partite").click();
  await expect(header(page, "guida-partite")).toHaveAttribute("aria-expanded", "true");
  await expect(section(page, "guida-partite").locator("ul")).toBeVisible();
  await expect(header(page, "guida-assenze")).toHaveAttribute("aria-expanded", "false");

  // «Apri tutte» / «Chiudi tutte».
  await page.locator("[data-guide-toggle-all]").click();
  await expect(header(page, "guida-assenze")).toHaveAttribute("aria-expanded", "true");
  await page.locator("[data-guide-toggle-all]").click();
  await expect(header(page, "guida-partite")).toHaveAttribute("aria-expanded", "false");

  // La ricerca: senza accenti, restano le sezioni che ne parlano, già aperte.
  const total = await page.locator("[data-guide-section]").count();
  await page.locator("[data-guide-search]").fill("certificato");
  await expect(page.locator("[data-guide-count]")).toContainText("ne parl");
  const visible = await page.locator("[data-guide-section]:visible").count();
  expect(visible).toBeGreaterThan(0);
  expect(visible).toBeLessThan(total);
  await expect(header(page, "guida-certificati-medici")).toHaveAttribute("aria-expanded", "true");
  await expect(section(page, "guida-allenamenti")).toBeHidden();

  // Una parola che non c'è: lo dice.
  await page.locator("[data-guide-search]").fill("zzxxyyqq");
  await expect(page.locator("[data-guide-count]")).toContainText("Nessuna sezione");
  await expect(page.locator("[data-guide-section]:visible")).toHaveCount(0);

  // Cancellata la ricerca si torna all'elenco chiuso.
  await page.getByRole("button", { name: "Cancella la ricerca" }).click();
  await expect(page.locator("[data-guide-section]:visible")).toHaveCount(total);
  await expect(header(page, "guida-partite")).toHaveAttribute("aria-expanded", "false");
});

test("guida: un indirizzo con #sezione apre quella sezione", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsDev(page);
  await switchTeam(page, "u14u15");
  await page.goto("/admin/guida#guida-presenze");
  await expect(header(page, "guida-presenze")).toHaveAttribute("aria-expanded", "true");
  await expect(section(page, "guida-presenze").locator("ul")).toBeVisible();
  await expect(header(page, "guida-partite")).toHaveAttribute("aria-expanded", "false");
});
