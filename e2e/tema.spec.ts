import { test, expect, type Page } from "@playwright/test";
import { loginAsDev } from "./helpers";

const scheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.colorScheme);
const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Sceglie il tema dal pulsante con sole/luna del sito pubblico e della pagina di accesso. */
async function chooseFromPopover(page: Page, label: "Chiaro" | "Scuro" | "Automatico") {
  // Un clic prima che la pagina sia pronta (hydration) andrebbe perso.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tema del sito" }).click();
  await page.getByRole("menuitemradio", { name: label }).click();
}

test("tema chiaro/scuro: parte chiaro, si sceglie ovunque e resta anche dopo il ricaricamento", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    // Niente tour o banner a coprire le intestazioni (non toccano la scelta del tema).
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    localStorage.setItem("vl-public-tour-seen-minivolley", "1");
  });

  // Senza scelta il sito resta chiaro, anche se il dispositivo è scuro.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await scheme(page)).toBe("light");
  const lightBackground = await bodyBackground(page);

  // Scuro dal sito pubblico: cambia subito e il fondo diventa scuro.
  await chooseFromPopover(page, "Scuro");
  expect(await scheme(page)).toBe("dark");
  expect(await bodyBackground(page)).not.toBe(lightBackground);

  // Dopo il ricaricamento è già scuro prima che la pagina si sia disegnata (niente lampo bianco).
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await scheme(page)).toBe("dark");
  expect(await bodyBackground(page)).not.toBe(lightBackground);

  // Anche il sito Minivolley segue, con i suoi colori (corallo, più chiaro per leggersi sul fondo scuro).
  await page.goto("/minivolley");
  expect(await scheme(page)).toBe("dark");
  const minivolleyPrimary = await page.evaluate(() =>
    getComputedStyle(document.querySelector('[data-theme="minivolley"]')!).getPropertyValue("--primary").trim(),
  );
  expect(minivolleyPrimary).toBe("#ff8a63");

  // Automatico: segue il dispositivo, anche mentre la pagina è aperta.
  await page.goto("/");
  await chooseFromPopover(page, "Automatico");
  expect(await scheme(page)).toBe("dark"); // il dispositivo è scuro
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => scheme(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => scheme(page)).toBe("dark");

  // Pagina di accesso: il selettore c'è e vale per tutto il sito.
  await page.goto("/login");
  await chooseFromPopover(page, "Chiaro");
  expect(await scheme(page)).toBe("light");

  // Area tecnici: nel menu dell'account, accanto alle altre voci.
  await loginAsDev(page);
  await page.getByRole("button", { name: "Menu account" }).click();
  const themeGroup = page.getByRole("group", { name: "Tema del sito" });
  await themeGroup.getByRole("button", { name: "Scuro" }).click();
  expect(await scheme(page)).toBe("dark");
  await page.goto("/admin/test-fisici/riepilogo");
  expect(await scheme(page)).toBe("dark");
  expect(await bodyBackground(page)).not.toBe(lightBackground);
});
