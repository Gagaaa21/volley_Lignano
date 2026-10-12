/**
 * Come si alternano le fasi di uno scambio, scritto una volta sola: lo leggono
 * lo Scout (livelli «Con ricezioni» e «Completo»), la guida e il manuale in PDF.
 */

export interface PhaseStep {
  title: string;
  text: string;
}

export const PHASE_STEPS: PhaseStep[] = [
  {
    title: "Battuta",
    text: "Ogni scambio comincia da qui: batte la squadra che ha la battuta (la riconosci dal pallone verde sul tabellone e, se segui la formazione, è la giocatrice in posizione 1). Un ace o un errore chiudono subito lo scambio e assegnano il punto.",
  },
  {
    title: "Ricezione",
    text: "L'altra squadra riceve la battuta: segni chi ha ricevuto e con che voto, da # (perfetta) a = (errore). Un voto «scarso» (/) vuol dire che la palla è tornata di là.",
  },
  {
    title: "Alzata e attacco",
    text: "Chi ha ricevuto alza (l'alzata la segni solo se vuoi: se non ti interessa passi direttamente all'attacco) e poi attacca. L'attacco può andare a terra (punto), fuori o in rete (errore), essere murato oppure difeso.",
  },
  {
    title: "Muro e difesa",
    text: "La squadra che subisce l'attacco può murare e poi difende. Se il muro ferma la palla a terra è punto; se la tocca soltanto, difende chi ha murato; se l'attacco è difeso, difende l'altra squadra.",
  },
  {
    title: "Di qua e di là",
    text: "Dopo la difesa si alza e si attacca a propria volta: la palla va avanti e indietro sopra la rete, ogni volta nell'ordine ricezione o difesa, alzata, attacco, finché un voto chiude lo scambio.",
  },
  {
    title: "Il punto",
    text: "Lo scambio finisce con un ace, un errore, un attacco a terra o un muro vincente: il punto si assegna da solo. Chi vince senza aver battuto conquista la battuta (e, con la formazione, ruota); chi batteva e vince continua a battere.",
  },
];

/** Il percorso della palla in una riga, per le guide. */
export const PHASE_FLOW = "Battuta → Ricezione → (Alzata) → Attacco → Muro o Difesa → (di là) Alzata → Attacco → … → punto";
