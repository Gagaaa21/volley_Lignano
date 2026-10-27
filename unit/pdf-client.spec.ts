import { expect, test } from "@playwright/test";
import { isAppleTouchDevice, pdfOpensInSheet } from "@/lib/pdf/client";

/**
 * Su iPhone e iPad un PDF non si apre mai come pagina (con il sito sulla schermata Home non c'è «indietro» né un modo per
 * salvarlo o mandarlo): per saperlo basta riconoscere questi dispositivi, anche l'iPad che si presenta come un Mac.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

test("si riconoscono iPhone, iPad e iPad che si presenta come un Mac; il resto no", () => {
  expect(isAppleTouchDevice({ userAgent: IPHONE, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
  expect(isAppleTouchDevice({ userAgent: IPAD, platform: "iPad", maxTouchPoints: 5 })).toBe(true);
  // iPadOS 13 e successivi, di serie, si annunciano come un Mac: li tradisce lo schermo a tocco.
  expect(isAppleTouchDevice({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  // Un vero Mac, Android e Windows (anche con lo schermo a tocco) no.
  expect(isAppleTouchDevice({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  expect(isAppleTouchDevice({ userAgent: ANDROID, platform: "Linux armv81", maxTouchPoints: 5 })).toBe(false);
  expect(isAppleTouchDevice({ userAgent: WINDOWS, platform: "Win32", maxTouchPoints: 10 })).toBe(false);
});

test("il PDF si apre in un foglio sui telefoni e sui tablet, in una scheda sul computer", () => {
  // iPhone e iPad: sempre nel foglio, anche senza condivisione di file e senza schermo «a tocco» dichiarato.
  expect(pdfOpensInSheet({ apple: true, canShareFiles: true, coarsePointer: true })).toBe(true);
  expect(pdfOpensInSheet({ apple: true, canShareFiles: false, coarsePointer: false })).toBe(true);
  // Android e simili: schermo a tocco e condivisione di file.
  expect(pdfOpensInSheet({ apple: false, canShareFiles: true, coarsePointer: true })).toBe(true);
  // Il computer, anche se il browser sa condividere file (Chrome su Windows): si usa con il mouse, il PDF si apre in una scheda.
  expect(pdfOpensInSheet({ apple: false, canShareFiles: true, coarsePointer: false })).toBe(false);
  // Uno schermo a tocco senza condivisione di file (un computer a tocco, un browser vecchio): il link normale.
  expect(pdfOpensInSheet({ apple: false, canShareFiles: false, coarsePointer: true })).toBe(false);
  expect(pdfOpensInSheet({ apple: false, canShareFiles: false, coarsePointer: false })).toBe(false);
});
