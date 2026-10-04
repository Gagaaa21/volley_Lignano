import { defineConfig } from "@playwright/test";

/**
 * Test "puri" (funzioni senza rete né server, es. il lettore delle pagine
 * della federazione): niente avvio di `next dev`, niente login. Veloci,
 * si eseguono con `npm run test:unit`. I test del sito vero restano in
 * ./e2e (playwright.config.ts).
 */
export default defineConfig({
  testDir: "./unit",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
});
