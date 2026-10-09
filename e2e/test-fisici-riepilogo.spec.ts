import { test, expect, type Page } from "@playwright/test";
import { loginAsDev, switchTeam, uniqueName } from "./helpers";

async function createAthlete(page: Page, fullName: string) {
  await page.goto("/admin/presenze/atlete/nuova");
  await page.getByLabel("Nome e cognome").fill(fullName);
  await page.getByLabel(/Categoria/i).selectOption("U14");
  await page.getByRole("button", { name: /salva atleta/i }).click();
  await page.waitForURL(/\/admin\/presenze\/atlete$/, { timeout: 20_000 });
}

async function addSession(page: Page, fullName: string, date: string, values: { peso?: string; salto?: string[] }) {
  await page.goto("/admin/test-fisici/nuovo");
  await page.getByRole("link", { name: fullName }).click();
  await page.waitForURL(/\/admin\/test-fisici\/nuovo\/[^/]+$/, { timeout: 20_000 });
  await page.getByLabel("Data della sessione").fill(date);
  if (values.peso) await page.getByLabel("Peso in kg").fill(values.peso);
  for (const [i, altezza] of (values.salto ?? []).entries()) {
    await page.getByLabel(`Salto ${i + 1}, altezza in centimetri`).fill(altezza);
  }
  await page.getByRole("button", { name: /salva test/i }).click();
  await page.waitForURL(/\/admin\/test-fisici\/atleta\/[^/]+$/, { timeout: 20_000 });
}

test("riepilogo test fisici: tutte le atlete in una tabella, con ricerca, ordine, giorno e CSV", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    localStorage.setItem("vl-pwa-install-prompted", "1");
    localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  const unique = uniqueName("Riep ");
  const anna = `${unique} Anna`;
  const bea = `${unique} Bea`;
  await createAthlete(page, anna);
  await createAthlete(page, bea);
  // Anna: due sessioni (il peso scende, il salto sale); Bea: una sola, salta più in alto.
  await addSession(page, anna, "2026-03-10", { peso: "50", salto: ["40", "44"] });
  await addSession(page, anna, "2026-04-02", { peso: "48.5", salto: ["46"] });
  await addSession(page, bea, "2026-04-02", { salto: ["50", "52"] });

  await page.goto("/admin/test-fisici/riepilogo");
  await page.getByRole("button", { name: "Tutte le sessioni" }).click();
  // Il filtro per nome tiene solo le due atlete di questa prova.
  await page.getByLabel("Cerca un'atleta").fill(unique);
  const row = (name: string, date?: string) =>
    page.locator("[data-riepilogo-row]", { hasText: name }).filter({ hasText: date ?? "" });

  // Ultimi risultati: una riga per atleta, con l'ultimo valore di ogni misura e la variazione.
  await page.getByRole("button", { name: "Ultimi risultati" }).click();
  await expect(page.locator("[data-riepilogo-row]")).toHaveCount(2);
  const annaLatest = row(anna);
  await expect(annaLatest).toContainText("48,5");
  await expect(annaLatest).toContainText("−1,5"); // peso: 50 → 48,5
  await expect(annaLatest).toContainText("46"); // salto: media dell'ultima sessione
  await expect(annaLatest).toContainText("+4"); // salto: 42 → 46
  await expect(row(bea)).toContainText("51"); // media di 50 e 52

  // Il salto più alto della colonna è evidenziato (Bea, 51 contro 46).
  await expect(row(bea).getByTitle("Il valore più alto della colonna")).toHaveText("51");
  await expect(annaLatest.getByTitle("Il valore più alto della colonna")).toHaveCount(0);

  // Ordinare per altezza del salto: con un clic dal più alto, con un altro dal più basso.
  const names = () => page.locator("[data-riepilogo-row] th a .truncate").allInnerTexts();
  await page.getByRole("button", { name: /Salto · altezza/ }).click();
  expect((await names())[0]).toContain("Bea");
  await page.getByRole("button", { name: /Salto · altezza/ }).click();
  expect((await names())[0]).toContain("Anna");

  // Un giorno: solo chi è stato provato quel giorno, e chi manca viene detto.
  await page.getByRole("button", { name: "Un giorno" }).click();
  await page.getByLabel("Giorno del test").selectOption("2026-03-10");
  await expect(page.locator("[data-riepilogo-row]")).toHaveCount(1);
  await expect(row(anna)).toContainText("50");
  await expect(page.getByText(`Senza test in questo giorno`)).toContainText(bea);

  // Tutte le sessioni: tre righe, dalla più recente.
  await page.getByRole("button", { name: "Tutte le sessioni" }).click();
  await expect(page.locator("[data-riepilogo-row]")).toHaveCount(3);

  // Scarica quello che si vede.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("test-fisici-tutte.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Atleta,Categoria,Data,Peso (kg)");
  expect(csv).toContain(`${anna},Under 14,2026-04-02,48.5`);
});
