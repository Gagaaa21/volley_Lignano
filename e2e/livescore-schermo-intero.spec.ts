import { expect, test, type Page } from "@playwright/test";
import { loginAsDev, switchTeam } from "./helpers";

/**
 * Il pulsante "Schermo intero" del live score deve funzionare su ogni dispositivo:
 * - Chrome e simili: schermo intero vero;
 * - Safari su iPad: solo l'API con prefisso "webkit";
 * - iPhone o app installata sulla schermata Home: nessuno schermo intero vero, si usa quello simulato.
 */
const SCENARIOS = {
  chrome: undefined,
  "safari iPad (API con prefisso)": () => {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const original = proto.requestFullscreen as () => Promise<void>;
    proto.webkitRequestFullscreen = function (this: Element) {
      return original.call(this);
    };
    delete proto.requestFullscreen;
    const real = Object.getOwnPropertyDescriptor(Document.prototype, "fullscreenElement")!.get!;
    Object.defineProperty(document, "webkitFullscreenElement", { get: () => real.call(document) });
    Object.defineProperty(document, "fullscreenElement", { get: () => undefined });
    (document as unknown as Record<string, unknown>).webkitExitFullscreen = () => document.exitFullscreen();
    document.addEventListener("fullscreenchange", () => document.dispatchEvent(new Event("webkitfullscreenchange")));
  },
  "senza schermo intero vero (iPhone, app installata)": () => {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    delete proto.requestFullscreen;
    delete proto.webkitRequestFullscreen;
  },
} as const;

/** Il riquadro del live score ricopre tutta la finestra? */
async function stageFillsWindow(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector("div.hidden.sm\\:block") as HTMLElement;
    const r = stage.getBoundingClientRect();
    return r.x === 0 && r.y === 0 && Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight;
  });
}

for (const [name, init] of Object.entries(SCENARIOS)) {
  test(`live score: schermo intero (${name})`, async ({ page }) => {
    test.setTimeout(120_000);
    page.on("dialog", (dialog) => dialog.accept());
    await page.context().addInitScript(() => {
      localStorage.setItem("vl-pwa-install-prompted", "1");
      localStorage.setItem("vl-pwa-notify-last-prompted-at", String(Date.now()));
    });
    if (init) await page.addInitScript(init);
    await loginAsDev(page);
    await switchTeam(page, "u14u15");
    await page.goto("/admin/livescore");
    await page.waitForLoadState("networkidle");
    const skipTour = page.getByRole("button", { name: "Salta il tour" });
    if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

    // Una partita salvata da una prova precedente si ricarica da sola: si riparte da zero.
    const reset = page.getByRole("button", { name: "Nuovo" });
    if (await reset.isVisible().catch(() => false)) await reset.click();

    const enter = page.getByRole("button", { name: "Schermo intero" }).first();
    const leaveSetup = page.getByRole("button", { name: "Esci da schermo intero" });
    const leaveGame = page.getByRole("button", { name: "Esci", exact: true });

    // Schermata di impostazione
    await enter.click();
    await expect(leaveSetup).toBeVisible();
    expect(await stageFillsWindow(page)).toBe(true);
    await leaveSetup.click();
    await expect(enter).toBeVisible();
    expect(await stageFillsWindow(page)).toBe(false);

    // Partita in corso
    await page.getByRole("button", { name: "Inizia" }).click();
    await enter.click();
    await expect(leaveGame).toBeVisible();
    expect(await stageFillsWindow(page)).toBe(true);

    if (name.startsWith("senza")) {
      // Lo schermo intero simulato si chiude anche con Esc (quello vero lo chiude il browser).
      await page.keyboard.press("Escape");
      await expect(enter).toBeVisible();
      await enter.click();
      await expect(leaveGame).toBeVisible();
    }
    await leaveGame.click();
    await expect(enter).toBeVisible();
    expect(await stageFillsWindow(page)).toBe(false);
    // La pagina sotto torna a scorrere.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    // Lascia il live score pulito per chi viene dopo.
    await page.getByRole("button", { name: "Nuovo" }).click();
  });
}
