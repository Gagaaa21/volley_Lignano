import { expect, test } from "@playwright/test";
import { areValidPushKeys, isAllowedPushEndpoint } from "../src/lib/pushEndpoint";

test.describe("indirizzi di notifica accettati", () => {
  test("i servizi push dei browser veri passano (anche quelli già iscritti al sito)", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc123:APA91bE",
      "https://web.push.apple.com/QGoVS1cC3TzUH9zA",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
      "https://api.push.apple.com/3/device/abc",
      "https://FCM.googleapis.com:443/fcm/send/abc",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(true);
    }
  });

  test("un indirizzo qualsiasi non passa: il server non deve contattare siti scelti da un visitatore", () => {
    for (const endpoint of [
      "https://push.example/e2e-1",
      "https://example.com/fcm.googleapis.com",
      "https://evil.com/?https://fcm.googleapis.com/",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evilfcm.googleapis.com/x",
      "https://notify.windows.com.evil.com/x",
      "https://xnotify.windows.com/x",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  test("niente rete interna, http, credenziali o porte strane, nemmeno con un host giusto", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://user:pass@fcm.googleapis.com/fcm/send/abc",
      "https://user@fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/fcm/send/abc",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/x",
      "ftp://fcm.googleapis.com/x",
      "javascript:alert(1)",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  test("vuoto, non un indirizzo o troppo lungo: no", () => {
    expect(isAllowedPushEndpoint("")).toBe(false);
    expect(isAllowedPushEndpoint("fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("non un indirizzo")).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/fcm/send/${"a".repeat(2100)}`)).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/fcm/send/${"a".repeat(1500)}`)).toBe(true);
  });
});

test.describe("chiavi dell'iscrizione", () => {
  test("chiavi vere (87 e 22 caratteri) passano; vuote o enormi no", () => {
    expect(areValidPushKeys("B".repeat(87), "a".repeat(22))).toBe(true);
    expect(areValidPushKeys("", "a")).toBe(false);
    expect(areValidPushKeys("b", "")).toBe(false);
    expect(areValidPushKeys("B".repeat(5000), "a")).toBe(false);
    expect(areValidPushKeys("b", "a".repeat(5000))).toBe(false);
  });
});
