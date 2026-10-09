import { expect, test } from "@playwright/test";
import { isQuotaError, retryDelayMs } from "@/lib/geminiErrors";

// Come li lancia @google/genai: Error con `status` e il corpo JSON della risposta come messaggio.
function apiError(status: number, body: object) {
  return Object.assign(new Error(JSON.stringify(body)), { status });
}

const DAILY_QUOTA = {
  error: {
    code: 429,
    message: "You exceeded your current quota.\nPlease retry in 6h10m20.37s.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "22220s" }],
  },
};

test.describe("errori di Gemini", () => {
  test("riconosce il limite di richieste finito, non gli altri errori", () => {
    expect(isQuotaError(apiError(429, DAILY_QUOTA))).toBe(true);
    expect(isQuotaError(new Error('{"error":{"status":"RESOURCE_EXHAUSTED"}}'))).toBe(true);
    expect(isQuotaError(apiError(503, { error: { code: 503, status: "UNAVAILABLE" } }))).toBe(false);
    expect(isQuotaError(new DOMException("timeout", "TimeoutError"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError("429")).toBe(false);
  });

  test("quanto aspettare: dal campo retryDelay, altrimenti dal testo, con limiti", () => {
    // 22220 s sono più di 6 ore: si ferma al massimo di 6 ore.
    expect(retryDelayMs(apiError(429, DAILY_QUOTA))).toBe(6 * 60 * 60 * 1000);
    expect(retryDelayMs(apiError(429, { error: { details: [{ retryDelay: "45s" }] } }))).toBe(45_000);
    expect(retryDelayMs(new Error("Quota exceeded. Please retry in 2m10s."))).toBe(130_000);
    expect(retryDelayMs(new Error("Please retry in 1h5m."))).toBe(65 * 60 * 1000);
    // Molto breve: almeno 30 secondi. Nessuna indicazione: un minuto.
    expect(retryDelayMs(apiError(429, { error: { details: [{ retryDelay: "2s" }] } }))).toBe(30_000);
    expect(retryDelayMs(new Error("boom"))).toBe(60_000);
    expect(retryDelayMs(undefined)).toBe(60_000);
  });
});
