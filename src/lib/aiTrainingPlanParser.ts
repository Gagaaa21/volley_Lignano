import { GoogleGenAI, Type } from "@google/genai";
import { TOTAL_RE, type ParsedBlock, type ParsedTrainingText } from "./trainingPlanParser";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          headingLine: {
            type: Type.STRING,
            description:
              "La riga di intestazione ESATTAMENTE come appare nel testo originale, carattere per carattere (stessi spazi, stessa punteggiatura, stesso trattino/apostrofo) — es. \"3. RICEZIONE – 30’\". Mai corretta, riformattata o parafrasata.",
          },
          title: { type: Type.STRING, description: "Titolo del blocco, senza numero né durata." },
          durationMinutes: { type: Type.INTEGER, description: "Durata del blocco in minuti, come numero intero." },
        },
        required: ["headingLine", "title", "durationMinutes"],
      },
    },
  },
  required: ["blocks"],
};

const SYSTEM_INSTRUCTION = `Sei un assistente che individua le intestazioni dei blocchi in un testo di allenamento di
pallavolo incollato da un allenatore, spesso introdotte da righe come "1. TITOLO – 10'" (numero, titolo, durata) ma con
formattazione irregolare (durate "circa", trattini diversi, titoli con più parole).

Il tuo UNICO compito è individuare ogni riga di intestazione di un blocco numerato e restituirla ESATTAMENTE come
appare nel testo originale (stessi spazi, stessa punteggiatura, stesso apostrofo/trattino), insieme al titolo e alla
durata che ne estrai. Il contenuto che segue ogni intestazione NON lo scrivi tu: lo estrae il programma dal testo
originale copiandolo carattere per carattere, quindi non devi mai riassumerlo, correggerlo, tradurlo, riordinarlo o
inventarlo — anche solo descriverlo diversamente da come è scritto (es. cambiare "esercizi" in "stazioni", o
aggiungere dettagli come zone del campo non menzionate) è un errore grave.

Non considerare intestazione una riga che introduce un singolo esercizio più breve dentro un blocco più ampio (es.
"5' – Palleggio spinto da zona 1 → zona 5", durata scritta PRIMA del titolo): fa parte del contenuto del blocco
numerato che la precede, non è un nuovo blocco. Non inventare intestazioni che non esistono nel testo e non alterare
l'ordine in cui compaiono.`;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

async function generateWithRetry(client: GoogleGenAI, text: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: text,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      });
    } catch (err) {
      // Il modello flash può restituire 503 (sovraccarico temporaneo): un solo
      // ritentativo dopo una breve pausa evita di rinunciare all'IA per un blip.
      if (attempt === 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw new Error("unreachable");
}

/**
 * Ripiego basato su IA per dividere un testo di allenamento in blocchi quando il parser
 * regex (parseTrainingPlanText) non riesce a riconoscere la formattazione. Ritorna null
 * per qualsiasi errore/assenza di configurazione, cosicché il chiamante possa ricadere
 * sul risultato del parser regex senza interrompere la creazione della scheda.
 *
 * L'IA individua SOLO dove inizia ogni blocco (titolo, durata, riga di intestazione
 * esatta): il contenuto di ogni blocco viene sempre ritagliato dal testo originale con
 * un semplice taglio di stringa, mai riscritto dal modello. Se una riga di intestazione
 * restituita dall'IA non corrisponde esattamente (carattere per carattere) a una riga del
 * testo originale — segno che il modello l'ha alterata invece di copiarla — l'intero
 * risultato viene scartato e si ricade sul parser regex, per non rischiare di salvare
 * contenuto inventato o riformulato.
 */
export async function parseTrainingPlanWithAI(raw: string): Promise<ParsedTrainingText | null> {
  const cleaned = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !TOTAL_RE.test(line.trim()))
    .join("\n")
    .trim();
  if (!cleaned) return null;

  const client = getClient();
  if (!client) return null;

  try {
    const response = await generateWithRetry(client, cleaned);

    const responseText = response.text;
    if (!responseText) return null;

    const parsed = JSON.parse(responseText) as {
      blocks?: Array<{ headingLine?: unknown; title?: unknown; durationMinutes?: unknown }>;
    };
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) return null;

    const headings: { headingLine: string; title: string; durationMinutes: number }[] = [];
    for (const b of parsed.blocks) {
      if (typeof b.headingLine !== "string" || typeof b.title !== "string") continue;
      const durationMinutes =
        typeof b.durationMinutes === "number" ? Math.round(b.durationMinutes) : Number(b.durationMinutes);
      const title = b.title.trim();
      if (!title || !Number.isFinite(durationMinutes) || durationMinutes <= 0) continue;
      headings.push({ headingLine: b.headingLine, title, durationMinutes });
    }
    if (headings.length === 0) return null;

    // Localizza ogni intestazione nel testo originale, in ordine di comparsa.
    const positions: number[] = [];
    let cursor = 0;
    for (const { headingLine } of headings) {
      const idx = cleaned.indexOf(headingLine, cursor);
      if (idx === -1) return null;
      positions.push(idx);
      cursor = idx + headingLine.length;
    }

    const blocks: ParsedBlock[] = [];
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i] + headings[i].headingLine.length;
      const end = i + 1 < positions.length ? positions[i + 1] : cleaned.length;
      const content = cleaned.slice(start, end).trim();
      if (content) blocks.push({ title: headings[i].title, durationMinutes: headings[i].durationMinutes, content });
    }
    if (blocks.length === 0) return null;

    return { preamble: cleaned.slice(0, positions[0]).trim(), blocks };
  } catch {
    return null;
  }
}
