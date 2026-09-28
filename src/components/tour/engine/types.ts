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
  body: string;
}
