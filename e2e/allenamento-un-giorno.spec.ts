import { expect, test } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/** Data locale "YYYY-MM-DD" fra n giorni (il server ragiona in date locali). */
function dayAfter(n: number): { iso: string; weekday: number } {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { iso, weekday: d.getDay() };
}

test("un allenamento ricorrente si sposta solo per un giorno e poi torna come sempre", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
      localStorage.setItem("vl-public-tour-seen-u14u15", "1");
    } catch {
      // localStorage non disponibile: il test funziona comunque.
    }
  });
  await loginAsDev(page);
  await switchTeam(page, "u14u15");

  // Ogni settimana nel giorno di domani, 19:00–21:00 al Palazzetto.
  const tomorrow = dayAfter(1);
  const nextWeek = dayAfter(8);
  await page.goto("/admin/allenamenti/nuovo");
  await page.getByLabel("Titolo").fill("Allenamento spostato E2E");
  await page.getByLabel("Luogo").fill("Palazzetto E2E");
  await page.locator(`input[name="weekdays"][value="${tomorrow.weekday}"]`).check({ force: true });
  await page.locator('input[name="startTime"]').fill("19:00");
  await page.locator('input[name="endTime"]').fill("21:00");
  await page.getByRole("button", { name: /salva allenamento/i }).click();
  await page.waitForURL(/\/admin\/allenamenti\/elenco$/, { timeout: 20_000 });
  const ruleHref = await page
    .locator('a[href^="/admin/allenamenti/"]', { hasText: "Allenamento spostato E2E" })
    .first()
    .getAttribute("href");
  const ruleId = ruleHref!.split("/").pop()!;

  // Toccando l'allenamento di domani (qui dalla dashboard) si apre quel giorno, non la serie.
  await page.goto("/admin");
  await page.locator(`a[href="/admin/allenamenti/scheda/${ruleId}/${tomorrow.iso}"]`).first().click();
  await page.waitForURL(new RegExp(`/admin/allenamenti/scheda/${ruleId}/${tomorrow.iso}$`));
  await expect(page.getByText("Modifica solo questo allenamento")).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifica tutta la serie" })).toBeVisible();

  // Domani: dalle 17:30 alle 19:30 alle Medie, solo per quel giorno.
  await page.goto(`/admin/allenamenti/scheda/${ruleId}/${tomorrow.iso}`);
  // I campi sono gestiti da React: si scrive solo a pagina pronta.
  await page.waitForLoadState("networkidle");
  const form = page.locator("[data-occurrence-override]");
  await expect(form.getByLabel("Ora inizio")).toHaveValue("19:00");
  await form.getByLabel("Ora inizio").fill("17:30");
  await form.getByLabel("Ora fine").fill("19:30");
  await form.getByLabel("Luogo", { exact: true }).fill("Palestra delle Medie E2E");
  await form.getByText("Avvisa con una notifica").click();
  await form.getByRole("button", { name: "Salva solo per questo giorno" }).click();
  await expect(form.getByRole("status")).toContainText("17:30–19:30 · Palestra delle Medie E2E");
  await expect(form.locator("[data-occurrence-usual]")).toContainText("Di solito: 19:00–21:00 · Palazzetto E2E");
  await expect(page.getByText("17:30–19:30 · Palestra delle Medie E2E (cambiato solo per questo giorno)")).toBeVisible();

  // Le altre date della serie non cambiano.
  await page.goto(`/admin/allenamenti/scheda/${ruleId}/${nextWeek.iso}`);
  await expect(page.locator("[data-occurrence-override]").getByLabel("Ora inizio")).toHaveValue("19:00");
  await expect(page.locator("[data-occurrence-usual]")).toHaveCount(0);

  // Sul sito pubblico domani compare spostato, con l'avviso.
  await page.goto("/");
  const agendaRow = page.getByRole("button", { name: /Allenamento spostato E2E/ }).filter({ hasText: "17:30–19:30" });
  await expect(agendaRow.first()).toBeVisible();
  await expect(agendaRow.first()).toContainText("Orario o luogo cambiati");
  await expect(agendaRow.first()).toContainText("Palestra delle Medie E2E");
  await agendaRow.first().click();
  await expect(page.locator("[data-training-changed]")).toContainText("Di solito: 19:00–21:00 · Palazzetto E2E");

  // Si torna all'orario di sempre.
  await page.goto(`/admin/allenamenti/scheda/${ruleId}/${tomorrow.iso}`);
  await page.waitForLoadState("networkidle");
  await page.locator("[data-occurrence-override]").getByText("Avvisa con una notifica").click();
  await page.getByRole("button", { name: "Torna all'orario di sempre" }).click();
  await expect(page.locator("[data-occurrence-override]").getByRole("status")).toContainText(
    "Tornato all'orario e al luogo di sempre",
  );
  await expect(page.locator("[data-occurrence-override]").getByLabel("Ora inizio")).toHaveValue("19:00");
  await expect(page.locator("[data-occurrence-usual]")).toHaveCount(0);

  // Non si fa: si annulla solo quel giorno e si torna al calendario.
  const cancel = page.locator("[data-occurrence-cancel]");
  await cancel.getByText("Avvisa con una notifica").click();
  page.once("dialog", (dialog) => dialog.accept());
  await cancel.getByRole("button", { name: "Annulla questo allenamento" }).click();
  await page.waitForURL(/\/admin\/allenamenti$/, { timeout: 20_000 });
  await page.goto(`/admin/allenamenti/${ruleId}`);
  const skipped = new Date(`${tomorrow.iso}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
  await expect(page.locator("section", { hasText: "Date saltate" })).toContainText(skipped);
});
