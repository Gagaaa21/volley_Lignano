// Finto Gemini per i test: nessuna chiamata a Google, nessun limite di richieste.
// Risponde sempre sulla porta 4010; la modalità si cambia al volo con
//   POST /__mode?m=ok      risposta buona (divide alle righe che sembrano intestazioni)
//   POST /__mode?m=busy    "modello sovraccarico" (503)
//   POST /__mode?m=quota   "limite di richieste finito" (429)
// e GET /__requests dice quante richieste sono arrivate dall'ultimo cambio di modalità.
import http from "node:http";

let mode = "ok";
let requests = 0;

// "1. Titolo – 10'", "A – 40' TITOLO", "TITOLO (40 min)"
const HEADINGS = [
  { re: /^\d+[.)]\s*(.+?)\s*[–—-]\s*(\d+)\s*['’]\s*$/, title: 1, minutes: 2 },
  { re: /^[A-Z]\s*[–—-]\s*(\d+)\s*['’]\s+(\S.*)$/, title: 2, minutes: 1 },
  { re: /^(\p{Lu}[^()]*?)\s*\((\d+)\s*min\)\s*$/u, title: 1, minutes: 2 },
];

function blocksFor(text) {
  const blocks = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    for (const { re, title, minutes } of HEADINGS) {
      const m = trimmed.match(re);
      if (m) {
        blocks.push({ headingLine: trimmed, title: m[title], durationMinutes: Number(m[minutes]) });
        break;
      }
    }
  }
  return blocks;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__health") return send(res, 200, { ok: true });
    if (url.pathname === "/__mode") {
      mode = url.searchParams.get("m") ?? "ok";
      requests = 0;
      return send(res, 200, { mode });
    }
    if (url.pathname === "/__requests") return send(res, 200, { mode, requests });

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests++;
      if (mode === "quota") {
        return send(res, 429, {
          error: {
            code: 429,
            message: "You exceeded your current quota.",
            status: "RESOURCE_EXHAUSTED",
            details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "1s" }],
          },
        });
      }
      if (mode === "busy") {
        return send(res, 503, { error: { code: 503, message: "High demand.", status: "UNAVAILABLE" } });
      }
      const request = JSON.parse(body);
      const text = (request.contents ?? []).flatMap((c) => (c.parts ?? []).map((p) => p.text ?? "")).join("\n");
      send(res, 200, {
        candidates: [
          {
            content: { role: "model", parts: [{ text: JSON.stringify({ blocks: blocksFor(text) }) }] },
            finishReason: "STOP",
            index: 0,
          },
        ],
      });
    });
  })
  .listen(4010);
