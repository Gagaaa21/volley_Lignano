import { expect, test } from "@playwright/test";
import { isAllowedFederationUrl, isAllowedLogoUrl, restoreLostFilters } from "@/lib/federation/url";

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

test.describe("indirizzi dei loghi consentiti", () => {
  test("solo le immagini dei loghi sui siti della federazione", () => {
    expect(isAllowedLogoUrl("https://udine.federvolley.it/mngArea/Societa/img/2555/Loghi/LogoS2555.png")).toBe(true);
    expect(isAllowedLogoUrl("https://udine.federvolley.it/mngArea/Societa/img/2521/Loghi/LogoS2521.jpg")).toBe(true);
    expect(isAllowedLogoUrl("https://friulivg.portalefipav.net/mngArea/Societa/img/10/Loghi/LogoS10.JPEG")).toBe(true);
  });

  test("niente altre pagine, altri formati o altri siti", () => {
    expect(isAllowedLogoUrl("https://udine.federvolley.it/risultati-classifiche.aspx")).toBe(false);
    expect(isAllowedLogoUrl("https://udine.federvolley.it/mngArea/Societa/img/2555/Loghi/logo.svg")).toBe(false);
    expect(isAllowedLogoUrl("https://udine.federvolley.it/mngArea/Societa/img/abc/Loghi/LogoS1.png")).toBe(false);
    expect(isAllowedLogoUrl("https://udine.federvolley.it/mngArea/Societa/img/1/Loghi/../../../x.png")).toBe(false);
    expect(isAllowedLogoUrl("https://udine.federvolley.it/mngArea/Societa/img/1/Loghi/LogoS1.png?x=1")).toBe(false);
    expect(isAllowedLogoUrl("https://example.com/mngArea/Societa/img/2555/Loghi/LogoS2555.png")).toBe(false);
    expect(isAllowedLogoUrl("http://udine.federvolley.it/mngArea/Societa/img/2555/Loghi/LogoS2555.png")).toBe(false);
    expect(isAllowedLogoUrl("")).toBe(false);
  });
});

test.describe("filtri persi in un reindirizzamento del portale", () => {
  const original =
    "https://udine.federvolley.it/risultati-classifiche.aspx?ComitatoId=48&StId=2428&DataDa=&StatoGara=&CId=92422&SId=&PId=15545&btFiltro=CERCA";

  test("si rimettono i filtri sulla pagina di arrivo", () => {
    const fixed = restoreLostFilters(original, "https://udine.federvolley.it/risultati-classifiche.aspx?PId=15544");
    expect(fixed).not.toBeNull();
    const url = new URL(fixed!);
    expect(url.pathname).toBe("/risultati-classifiche.aspx");
    expect(url.searchParams.get("PId")).toBe("15544");
    expect(url.searchParams.get("CId")).toBe("92422");
    expect(url.searchParams.get("StId")).toBe("2428");
    expect(url.searchParams.get("ComitatoId")).toBe("48");
  });

  test("niente da fare se i filtri ci sono ancora, la pagina o il sito sono altri", () => {
    expect(restoreLostFilters(original, original)).toBeNull();
    expect(restoreLostFilters(original, "https://udine.federvolley.it/")).toBeNull();
    expect(restoreLostFilters(original, "https://example.com/risultati-classifiche.aspx?PId=15544")).toBeNull();
    expect(
      restoreLostFilters(
        "https://udine.federvolley.it/risultati-classifiche.aspx?PId=15545",
        "https://udine.federvolley.it/risultati-classifiche.aspx?PId=15544",
      ),
    ).toBeNull();
    expect(restoreLostFilters("non un indirizzo", original)).toBeNull();
  });
});
