import type { ScoutLevel } from "./types";

/**
 * La legenda delle colonne del tabellino e la nota in fondo: cambiano col livello,
 * perché ne cambiano le colonne. Le usano insieme la pagina e il PDF, quindi il
 * testo è semplice (niente simboli che il font del PDF non ha).
 */

/** La legenda delle colonne: cambia col livello, perché ne cambiano le colonne. */
export function legendFor(level: ScoutLevel): [string, string][] {
  const common: [string, string][] = [
    ["Tot (Punti)", "Punti fatti: attacchi vincenti, muri e ace."],
    ["BP", "Di quei punti, quelli fatti mentre la propria squadra batteva (break point)."],
    ["V-P", "Punti fatti meno gli errori e gli attacchi murati."],
  ];
  if (level === "base") {
    return [
      ...common,
      ["Ace / Err", "Battute vincenti e battute sbagliate."],
      ["Ricez. Err", "Ricezioni sbagliate: la palla è toccata e finisce fuori o a terra. Se cade senza essere toccata è un ace di chi batte."],
      ["Attacco", "Attacchi vincenti (Pt), sbagliati (Err) e fermati dal muro avversario (Mur)."],
      ["Muro", "Muri vincenti (Pt) ed errori a muro (Err)."],
      ["Altri", "Alzate e difese sbagliate e falli fischiati attribuiti a una giocatrice."],
    ];
  }
  const reception: [string, string][] = [
    ["Ricezione Tot", "Le ricezioni che hai segnato (anche quelle sbagliate)."],
    ["Pos%", "Ricezioni positive (# e +) su quelle segnate."],
    ["Prf%", "Ricezioni perfette (#) su quelle segnate."],
  ];
  if (level === "ricezioni") {
    return [
      ...common,
      ["Ace / Err", "Battute vincenti e battute sbagliate."],
      ...reception,
      ["Attacco", "Attacchi vincenti (Pt), sbagliati (Err) e fermati dal muro avversario (Mur)."],
      ["Muro", "Muri vincenti (Pt) ed errori a muro (Err)."],
      ["Altri", "Alzate e difese sbagliate e falli fischiati attribuiti a una giocatrice."],
    ];
  }
  return [
    ...common,
    ["Battuta", "Battute segnate (Tot), sbagliate (Err) e vincenti (Ace)."],
    ...reception,
    ["Attacco", "Attacchi segnati (Tot), sbagliati (Err), fermati dal muro (Mur) e vincenti (Pt)."],
    ["Pt%", "Attacchi vincenti su quelli segnati."],
    ["Eff%", "Efficienza: (punti meno errori meno attacchi murati) su quelli segnati. Può essere negativa."],
    ["Muro", "Muri vincenti (Pt) ed errori a muro (Err)."],
    ["Difesa", "Difese riuscite (Dif, ogni voto tranne l'errore) e sbagliate (Err)."],
    ["Altri", "Alzate sbagliate e falli fischiati attribuiti a una giocatrice."],
  ];
}

export function footnoteFor(level: ScoutLevel): string {
  if (level === "base") {
    return "Lo scout a livello Base segna come finisce ogni scambio (chi fa punto e come), non ogni singolo tocco: per questo mancano attacchi tentati, ricezioni totali e le percentuali di attacco e di ricezione dei tabellini di Lega.";
  }
  if (level === "ricezioni") {
    return "A livello Con ricezioni contano le ricezioni che hai segnato: se in qualche scambio non l'hai fatto, quella ricezione non compare. Mancano ancora gli attacchi tentati e le percentuali di attacco, che servono al livello Completo.";
  }
  return "A livello Completo le percentuali sono calcolate sui tocchi che hai segnato: se in uno scambio hai segnato solo il punto, conta soltanto quel tocco finale.";
}

