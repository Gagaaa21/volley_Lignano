import { expect, test } from "@playwright/test";
import { isAllowedFederationUrl } from "@/lib/federation/url";

test.describe("indirizzi del girone consentiti", () => {
  test("pagine https della federazione, sottodomini dei comitati compresi", () => {
    expect(
      isAllowedFederationUrl("https://udine.federvolley.it/risultati-classifiche.aspx?ComitatoId=48&CId=93676"),
    ).toBe(true);
    expect(isAllowedFederationUrl("https://friulivg.portalefipav.net/classifica.aspx?CId=92837")).toBe(true);
    expect(isAllowedFederationUrl("https://federvolley.it/")).toBe(true);
  });

  test("nessun altro sito", () => {
    expect(isAllowedFederationUrl("https://example.com/risultati-classifiche.aspx")).toBe(false);
    expect(isAllowedFederationUrl("https://federvolley.it.example.com/")).toBe(false);
    expect(isAllowedFederationUrl("https://notfedervolley.it/")).toBe(false);
    expect(isAllowedFederationUrl("https://example.com/?u=https://udine.federvolley.it/")).toBe(false);
  });

  test("solo https (e solo http locale fuori produzione)", () => {
    expect(isAllowedFederationUrl("http://udine.federvolley.it/")).toBe(false);
    expect(isAllowedFederationUrl("ftp://udine.federvolley.it/")).toBe(false);
    expect(isAllowedFederationUrl("http://127.0.0.1:4010/girone")).toBe(process.env.NODE_ENV !== "production");
    expect(isAllowedFederationUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
  });

  test("testo che non è un indirizzo", () => {
    expect(isAllowedFederationUrl("")).toBe(false);
    expect(isAllowedFederationUrl("udine.federvolley.it")).toBe(false);
  });
});
