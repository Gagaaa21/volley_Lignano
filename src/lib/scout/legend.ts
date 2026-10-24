import type { ScoutLevel } from "./types";

/**
 * La legenda delle colonne del tabellino (quello come i tabellini delle leghe, src/lib/scout/sheet.ts) e la nota in fondo, per
 * livello: le colonne sono le stesse, cambia quello che si riesce a riempire. La usa il manuale d'uso, quindi il testo è semplice
 * (niente simboli che il font del PDF non ha).
 */

/** La legenda delle colonne: i livelli più alti aggiungono le voci che riescono a riempire. */
export function legendFor(level: ScoutLevel): [string, string][] {
  const common: [string, string][] = [
    ["Set", "Da dove è partita in ogni set (1 = in battuta, poi in senso orario); il rettangolo vuol dire che è entrata dopo, o che è la libero. Senza formazione il rettangolo dice solo che ha fatto qualcosa. I numeri dei set cerchiati: la squadra ha battuto per prima."],
    ["Tot (Punti)", "Punti fatti: attacchi vincenti, muri e ace."],
    ["BP", "Di quei punti, quelli fatti mentre la propria squadra batteva (break point)."],
    ["V-P", "Vinti meno persi: punti fatti meno errori e attacchi murati."],
    ["Battuta", "Battute (Tot), sbagliate (Err) e ace (Pt). Le battute di ogni giocatrice si contano se segui la formazione; il totale della squadra c'è sempre."],
    ["Attacco", "Attacchi sbagliati (Err), fermati dal muro avversario (Mur) e vincenti (Pt)."],
    ["Muro Pt", "Muri vincenti."],
    ["Punti vinti", "Set per set: Bat (ace), Att (attacco), Mu (muro), Er.Av (errori dell'avversaria)."],
    ["CP e BP", "In fondo: quante ricezioni servono per un punto in cambio palla (CP) e quante battute per un break point (BP), e in ogni rotazione i punti fatti meno quelli persi."],
  ];
  if (level === "base") {
    return [
      ...common,
      ["Ricezione Err", "Ricezioni sbagliate: la palla è toccata e finisce fuori o a terra. Se cade senza essere toccata è un ace di chi batte. Il resto della ricezione a livello Base non si segna (-)."],
    ];
  }
  const reception: [string, string][] = [
    ["Ricezione", "Le ricezioni segnate (Tot, anche quelle sbagliate) e quelle sbagliate (Err)."],
    ["Pos%", "Ricezioni positive (# e +) su quelle segnate."],
    ["Prf%", "Ricezioni perfette (#) su quelle segnate."],
  ];
  if (level === "ricezioni") {
    return [
      ...common,
      ...reception,
      ["Cambio palla dopo la ricezione", "In fondo, quante volte si vince lo scambio dopo una ricezione positiva (# e +) o negativa (!, - e /)."],
    ];
  }
  return [
    ...common,
    ...reception,
    ["Attacco Tot e Pt%", "Gli attacchi segnati e quanti a punto, in percentuale."],
    ["Cambio palla diretto", "Il primo attacco dopo una ricezione positiva (# e +) o negativa (!, - e /): sbagliati, murati, a punto in percentuale e quanti."],
    ["Contrattacco", "Tutti gli altri attacchi, con gli stessi numeri."],
  ];
}

export function footnoteFor(level: ScoutLevel): string {
  if (level === "base") {
    return "Lo scout a livello Base segna come finisce ogni scambio (chi fa punto e come), non ogni singolo tocco: per questo nel tabellino restano vuoti le ricezioni, gli attacchi tentati e le loro percentuali.";
  }
  if (level === "ricezioni") {
    return "A livello Con ricezioni contano le ricezioni che hai segnato: se in qualche scambio non l'hai fatto, quella ricezione non compare. Restano vuoti gli attacchi tentati, la percentuale di attacco e le ricezioni dell'avversaria.";
  }
  return "A livello Completo le percentuali sono calcolate sui tocchi che hai segnato: se in uno scambio hai segnato solo il punto, conta soltanto quel tocco finale.";
}
