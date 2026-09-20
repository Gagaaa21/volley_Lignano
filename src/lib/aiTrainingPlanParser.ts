import { GoogleGenAI, Type } from "@google/genai";
import type { ParsedTrainingText } from "./trainingPlanParser";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    preamble: {
      type: Type.STRING,
      description: "Testo introduttivo prima del primo blocco numerato (obiettivi, durata totale, ecc). Stringa vuota se assente.",
    },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Titolo del blocco, senza numero né durata." },
          durationMinutes: { type: Type.INTEGER, description: "Durata del blocco in minuti, come numero intero." },
          content: { type: Type.STRING, description: "Contenuto completo del blocco (tutte le righe fino al blocco successivo)." },
        },
        required: ["title", "durationMinutes", "content"],
      },
    },
  },
  required: ["preamble", "blocks"],
};

const SYSTEM_INSTRUCTION = `Sei un assistente che struttura testi di allenamenti di pallavolo incollati da un allenatore.
Il testo è diviso in "macro blocchi" (es. riscaldamento, circuito fisico, gioco finale), spesso introdotti da righe come
"1. TITOLO – 10'" ma con formattazione irregolare (durate "circa", trattini diversi, titoli con più parole).
Individua ogni blocco distinto, il suo titolo, la sua durata in minuti e tutto il suo contenuto (istruzioni, sotto-sezioni,
stazioni, elenchi puntati). Non inventare blocchi che non esistono nel testo e non perdere contenuto: ogni riga del testo
originale (esclusi titoli e intestazioni generiche) deve finire nel blocco a cui appartiene. Se una durata non è indicata
per un blocco, stima un valore ragionevole in base al contenuto.`;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Ripiego basato su IA per dividere un testo di allenamento in blocchi quando il parser
 * regex (parseTrainingPlanText) non riesce a riconoscere la formattazione. Ritorna null
 * per qualsiasi errore/assenza di configurazione, cosicché il chiamante possa ricadere
 * sul risultato del parser regex senza interrompere la creazione della scheda.
 */
export async function parseTrainingPlanWithAI(raw: string): Promise<ParsedTrainingText | null> {
  const text = raw.trim();
  if (!text) return null;

  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    });

    const raw2 = response.text;
    if (!raw2) return null;

    const parsed = JSON.parse(raw2) as {
      preamble?: unknown;
      blocks?: Array<{ title?: unknown; durationMinutes?: unknown; content?: unknown }>;
    };

    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) return null;

    const blocks = parsed.blocks
      .map((b) => ({
        title: typeof b.title === "string" ? b.title.trim() : "",
        durationMinutes: typeof b.durationMinutes === "number" ? Math.round(b.durationMinutes) : Number(b.durationMinutes),
        content: typeof b.content === "string" ? b.content.trim() : "",
      }))
      .filter((b) => b.title && Number.isFinite(b.durationMinutes) && b.durationMinutes > 0);

    if (blocks.length === 0) return null;

    return {
      preamble: typeof parsed.preamble === "string" ? parsed.preamble.trim() : "",
      blocks,
    };
  } catch {
    return null;
  }
}
