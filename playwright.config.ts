import { defineConfig, devices } from "@playwright/test";

/**
 * Il backend demo (repo in-memory, vedi src/lib/db/memory.ts) è condiviso
 * da tutte le richieste dello stesso processo `next dev`: eseguire più test
 * in parallelo li farebbe sporcare a vicenda (stesso problema già
 * incontrato più volte lavorando a mano su questo progetto). Per questo la
 * suite gira sempre in un solo worker, in sequenza — ogni file di test usa
 * comunque nomi/utenti con suffisso univoco per restare autonomo.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  // Ambiente sandbox con compilazione Turbopack on-demand e CPU condivisa:
  // le azioni singole (click/fill/navigazione) possono richiedere diversi
  // secondi più del solito. Timeout generosi qui evitano falsi negativi.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    // Permette di puntare a un binario Chromium già scaricato altrove
    // (es. in ambienti dove il download automatico è disabilitato) senza
    // dover cambiare questo file: PLAYWRIGHT_CHROMIUM_EXECUTABLE è opzionale
    // e ignorata se non impostata.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
