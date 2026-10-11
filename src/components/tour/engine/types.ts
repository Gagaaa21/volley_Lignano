export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Passo minimo che il motore condiviso sa gestire: un tour specifico (admin,
 * pubblico, di sezione) può estendere questa forma con campi propri (es. il
 * filtro per permessi di steps.ts) senza che il motore ne sappia nulla. */
export interface BaseTourStep {
  id: string;
  path: string;
  target: string | null;
  title: string;
  /** Testo del passo; in una guida lunga può avere più paragrafi, separati da una riga vuota. */
  body: string;
  /** Guide lunghe: il capitolo a cui appartiene il passo (piccola etichetta sopra il titolo). */
  chapter?: string;
  /** Un esempio concreto, in un riquadro a parte. */
  example?: string;
  /** Un consiglio utile, in un riquadro a parte. */
  tip?: string;
  /** Un'attenzione: qualcosa che è facile sbagliare, in un riquadro a parte. */
  warning?: string;
}

/** Un passo «ricco» (con capitolo, esempio, consiglio o attenzione) usa la scheda ampia, che scorre se il testo è lungo. */
export function isRichStep(step: BaseTourStep): boolean {
  return Boolean(step.chapter || step.example || step.tip || step.warning);
}
