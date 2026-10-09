import { GoogleGenAI, Type } from "@google/genai";
import { isQuotaError, retryDelayMs } from "./geminiErrors";
import { cleanTrainingText, splitAtHeadings, type BlockHeading, type ParsedTrainingText } from "./trainingPlanParser";

/**
 * Modelli da provare in ordine: i modelli "flash" sono spesso sovraccarichi
 * (errore 503), hanno un limite di richieste al minuto (429) o vengono
 * ritirati (404), quindi se uno non risponde si passa al successivo invece di
 * rinunciare all'IA. Ogni modello ha un limite suo: alternarli regge anche il
 * ricontrollo di molte schede di fila.
 */
const MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash"];
/** Tempo massimo per un modello e per tutti i tentativi insieme: poi si usa la divisione con regole fisse. */
const MODEL_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 45_000;

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
              "La riga che apre il blocco, copiata intera ESATTAMENTE come appare nel testo (stessi caratteri, spazi e punteggiatura).",
          },
          title: {
            type: Type.STRING,
            description: "Titolo del blocco, senza numero/lettera iniziale né durata, con le parole del testo.",
          },
          durationMinutes: {
            type: Type.INTEGER,
            description: "Durata del blocco in minuti; 0 se il testo non la indica.",
          },
        },
        required: ["headingLine", "title", "durationMinutes"],
      },
    },
  },
  required: ["blocks"],
};

const SYSTEM_INSTRUCTION = `Ricevi il testo di un allenamento di pallavolo scritto da un allenatore, spesso copiato da Word
o da WhatsApp con una formattazione irregolare. Il programma divide la seduta in BLOCCHI: le parti principali, una dopo
l'altra, ciascuna con un titolo e di solito una durata. Tu decidi quali righe del testo aprono un nuovo blocco.

Come decidere:
- Un blocco è una parte principale della seduta (riscaldamento, core, lavoro tecnico, gioco, defaticamento…). Le
  intestazioni hanno forme diverse: "1. TITOLO – 10'", "A – 45' TITOLO", "TITOLO (20 min)", "Parte 2: …", una riga in
  maiuscolo con la durata, e così via. Numeri, lettere, maiuscole o trattini da soli non bastano: conta il ruolo della
  riga nella struttura della seduta.
- Guarda la gerarchia. Se una parte con una sua durata (es. "A – 45' LAVORO ANALITICO SULL'ATTACCO") contiene esercizi
  numerati senza una durata propria ("1. Attacchi a muro", "2. Attacchi da Z4 – entrambi i campi"), il blocco è la parte
  e gli esercizi restano nel suo contenuto. Anche un esercizio breve con la durata davanti dentro una parte ("5' –
  Palleggio spinto da zona 1 → zona 5") resta nel contenuto della parte.
- Con più livelli, i blocchi sono quelli del livello più alto che scandisce i tempi della seduta. Le loro durate,
  sommate, dovrebbero dare più o meno la durata totale della seduta, se è indicata: usale per controllare la divisione.
- Il testo prima del primo blocco (introduzione, obiettivi, materiale) non è un blocco. Una riga "Totale …" non è un
  blocco.

Per ogni blocco, nell'ordine del testo:
- headingLine: la riga che lo apre, copiata intera e identica, carattere per carattere.
- title: il titolo senza numero o lettera iniziale e senza durata, con le stesse parole del testo.
- durationMinutes: i minuti indicati nell'intestazione (per "circa 60'" → 60); se l'intestazione non li indica, la somma
  delle durate scritte nel contenuto del blocco; altrimenti 0.

Non scrivere mai il contenuto dei blocchi: il programma lo ritaglia dal testo originale, quindi non riassumere, non
correggere e non inventare nulla. Non inventare intestazioni che non esistono e non cambiare l'ordine.`;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/** L'IA è configurata? (Senza chiave si usa solo la divisione con regole fisse.) */
export function isTrainingPlanAIAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Perché l'IA non ha potuto dividere il testo. */
export type AIFailure =
  /** Il limite gratuito di richieste è finito per tutti i modelli (si rinnova col tempo). */
  | "quota"
  /** Non risponde (sovraccarica, senza rete, tempo scaduto) o non è configurata. */
  | "unavailable"
  /** Ha risposto, ma con una divisione che non corrisponde al testo. */
  | "invalid";

class AIUnavailableError extends Error {
  constructor(readonly reason: Exclude<AIFailure, "invalid">) {
    super(reason === "quota" ? "Limite di richieste dell'IA esaurito." : "Nessun modello IA disponibile.");
  }
}

/**
 * Modelli a cui è finito il limite di richieste: finché non si rinnova (il
 * server dice tra quanto) li saltiamo, senza sprecare tempo a richiamarli.
 */
const cooldownUntil = new Map<string, number>();

async function generate(client: GoogleGenAI, text: string) {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let quotaFailures = 0;
  let otherFailures = 0;
  for (const model of MODELS) {
    if ((cooldownUntil.get(model) ?? 0) > Date.now()) {
      quotaFailures++;
      continue;
    }
    const remaining = deadline - Date.now();
    if (remaining < 2_000) break;
    try {
      return await client.models.generateContent({
        model,
        contents: text,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
          abortSignal: AbortSignal.timeout(Math.min(MODEL_TIMEOUT_MS, remaining)),
        },
      });
    } catch (err) {
      if (isQuotaError(err)) {
        quotaFailures++;
        cooldownUntil.set(model, Date.now() + retryDelayMs(err));
      } else {
        otherFailures++;
      }
      console.warn(`[parseTrainingPlanWithAI] ${model} non disponibile:`, err instanceof Error ? err.message : err);
    }
  }
  // "Limite finito" solo se è l'unico problema: se qualche modello era semplicemente sovraccarico, riprovare ha senso.
  throw new AIUnavailableError(quotaFailures > 0 && otherFailures === 0 ? "quota" : "unavailable");
}

/** Le righe che aprono i blocchi, secondo l'IA; null se l'IA non risponde o risponde male. */
async function findBlockHeadings(text: string): Promise<BlockHeading[] | null> {
  const client = getClient();
  if (!client) return null;

  const response = await generate(client, text);
  const responseText = response.text;
  if (!responseText) return null;

  const parsed = JSON.parse(responseText) as {
    blocks?: Array<{ headingLine?: unknown; title?: unknown; durationMinutes?: unknown }>;
  };
  if (!Array.isArray(parsed.blocks)) return null;

  const headings: BlockHeading[] = [];
  for (const b of parsed.blocks) {
    if (typeof b.headingLine !== "string" || !b.headingLine.trim()) continue;
    const durationMinutes = typeof b.durationMinutes === "number" ? b.durationMinutes : Number(b.durationMinutes);
    headings.push({
      headingLine: b.headingLine,
      title: typeof b.title === "string" ? b.title : "",
      durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 0,
    });
  }
  return headings.length > 0 ? headings : null;
}

export type AISplitResult =
  | { ok: true; value: ParsedTrainingText & { headings: BlockHeading[] } }
  | { ok: false; reason: AIFailure };

/**
 * Divide un testo di allenamento in blocchi lasciando decidere all'IA dove
 * inizia ogni blocco, qualunque sia la formattazione. Se non ci riesce dice
 * perché (limite di richieste finito, IA che non risponde, risposta non
 * valida), così chi la usa può avvisare con le parole giuste e riprovare.
 *
 * L'IA indica SOLO le righe che aprono i blocchi (con titolo e durata): il
 * contenuto di ogni blocco viene sempre ritagliato dal testo originale, mai
 * scritto dal modello. Se una riga indicata non esiste nel testo (segno che il
 * modello l'ha alterata) l'intero risultato viene scartato.
 */
export async function splitTrainingPlanWithAI(raw: string): Promise<AISplitResult> {
  const cleaned = cleanTrainingText(raw);
  if (!cleaned) return { ok: false, reason: "invalid" };
  if (!isTrainingPlanAIAvailable()) return { ok: false, reason: "unavailable" };
  try {
    const headings = await findBlockHeadings(cleaned);
    const parsed = headings ? splitAtHeadings(cleaned, headings) : null;
    return parsed && headings ? { ok: true, value: { ...parsed, headings } } : { ok: false, reason: "invalid" };
  } catch (err) {
    if (err instanceof AIUnavailableError) return { ok: false, reason: err.reason };
    console.error("[splitTrainingPlanWithAI]", err);
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Come splitTrainingPlanWithAI, ma ritorna null per qualsiasi errore (anche se
 * l'IA non è configurata): il chiamante ricade sulla divisione con regole fisse
 * senza interrompere il lavoro.
 */
export async function parseTrainingPlanWithAI(
  raw: string,
): Promise<(ParsedTrainingText & { headings: BlockHeading[] }) | null> {
  const result = await splitTrainingPlanWithAI(raw);
  return result.ok ? result.value : null;
}
