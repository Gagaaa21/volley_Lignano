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
Il testo contiene blocchi introdotti da righe come "1. TITOLO – 10'" (numero, titolo, durata), con formattazione
irregolare (durate "circa", trattini diversi, titoli con più parole).

Alcuni di questi blocchi numerati (es. "3. RICEZIONE – 30'") sono in realtà solo un'etichetta di sezione che
introduce una sequenza di esercizi più brevi, ciascuno con la propria riga "durata – titolo" (durata PRIMA del
titolo, es. "5' – Palleggio spinto da zona 1 → zona 5", "10' – Incrocio delle ricezioni"): sono esercizi DIVERSI
tra loro, da svolgere in sequenza uno dopo l'altro — non stazioni a rotazione, non varianti dello stesso
esercizio. In questo caso:
- NON creare un blocco per l'etichetta di sezione (es. "RICEZIONE"): i suoi minuti sono già la somma dei
  sotto-esercizi che la seguono, quindi da sola non ha contenuto proprio.
- Crea invece UN BLOCCO SEPARATO PER OGNI sotto-esercizio, usando il suo titolo e la sua durata così come sono
  scritti (es. titolo "Palleggio spinto da zona 1 → zona 5", durata 5), con tutto il testo che lo descrive come
  contenuto di quel blocco.

Un blocco numerato che invece ha già il proprio contenuto (senza sotto-esercizi con durata propria) resta un
blocco unico, come sempre.

Regole per il contenuto di ogni blocco:
- Copia il testo così come scritto, senza riformularlo, riassumerlo o riordinarlo: il tuo compito è capire dove
  finisce un blocco (o sotto-esercizio) e inizia il successivo, non riscrivere il testo dell'allenatore.
- Non inventare blocchi che non esistono nel testo e non perdere contenuto: ogni riga originale (esclusi i titoli
  numerati senza contenuto proprio e la riga "Totale") deve finire nel blocco a cui appartiene, nello stesso ordine.
- Se una durata non è indicata per un blocco, stima un valore ragionevole in base al contenuto.`;

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
 */
export async function parseTrainingPlanWithAI(raw: string): Promise<ParsedTrainingText | null> {
  const text = raw.trim();
  if (!text) return null;

  const client = getClient();
  if (!client) return null;

  try {
    const response = await generateWithRetry(client, text);

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
