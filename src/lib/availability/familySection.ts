/**
 * La pagina del genitore ha due sezioni distinte, scelte da due schede in alto: le assenze alle partite (quella di sempre, aperta di
 * serie) e il certificato medico. Il messaggio che lo staff manda per il certificato apre direttamente la sua scheda, con `?sezione=`
 * nell'indirizzo; un indirizzo con `#certificato` (come nei primi messaggi) fa lo stesso.
 */

export type FamilySection = "assenze" | "certificato";

export const FAMILY_SECTION_PARAM = "sezione";

/** Dalla querystring: qualunque altra cosa, o niente, è la sezione di serie. */
export function parseFamilySection(value: unknown): FamilySection {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "certificato" ? "certificato" : "assenze";
}

/** Il pezzo di indirizzo che apre una sezione: vuoto per quella di serie. */
export function familySectionQuery(section: FamilySection): string {
  return section === "certificato" ? `?${FAMILY_SECTION_PARAM}=certificato` : "";
}
