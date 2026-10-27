import type { Metadata } from "next";
import Link from "next/link";
import { PREDICTION_GRACE_LABEL } from "@/lib/predictions";
import { RULES_SEASON, SUBSTITUTIONS_PER_SET, TIMEOUT_SECONDS, TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import {
  Binoculars,
  CalendarClock,
  CalendarX2,
  Car,
  ClipboardCheck,
  Compass,
  FlaskConical,
  Gauge,
  Globe,
  KeyRound,
  Puzzle,
  Ruler,
  Stethoscope,
  Swords,
  Target,
  Trophy,
  Users,
  Video,
  Volleyball,
} from "lucide-react";
import { requireStaff, resolveActiveTeam, getOwnStaff } from "@/lib/auth/guard";
import { isPageAvailableForTeam, type AdminPage } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Guida",
};

interface Section {
  /** Assente per una sezione senza permesso dedicato (es. "Sito pubblico e
   * notifiche"): visibile a chiunque raggiunga questa pagina, senza filtro. */
  page?: AdminPage;
  icon: typeof CalendarClock;
  title: string;
  intro: string;
  points: string[];
}

const SECTIONS: Section[] = [
  {
    page: "allenamenti",
    icon: CalendarClock,
    title: "Allenamenti",
    intro: "Regole ricorrenti che generano automaticamente il calendario pubblico.",
    points: [
      "Ogni regola definisce giorni della settimana, orario, luogo e un periodo di validità (con data di fine facoltativa).",
      "Le regole attive compaiono nel calendario pubblico della homepage per tutte le settimane comprese nel periodo.",
      "Modificare o eliminare una regola aggiorna subito la vista pubblica e invia una notifica push a chi ha attivato le notifiche.",
      "Tocca un allenamento nel calendario (o in \"Prossimi impegni\" della dashboard) per modificare solo quello: in \"Modifica solo questo allenamento\" cambi orario e luogo di quel giorno (es. domani dalle 17:30 alle 19:30 alle Medie invece che dalle 19 alle 21 al Palazzetto) e con \"Annulla questo allenamento\" lo togli dal calendario. Le altre date della serie restano come sono; sul sito pubblico compare l'avviso \"Orario o luogo cambiati\" e, se vuoi, parte una notifica. \"Torna all'orario di sempre\" annulla la modifica; \"Modifica tutta la serie\" cambia invece tutte le date.",
    ],
  },
  {
    page: "partite",
    icon: Swords,
    title: "Partite",
    intro: "Partite di campionato per categoria U14/U15.",
    points: [
      "Ogni partita ha categoria, avversario, casa/trasferta, data/ora e luogo.",
      "L'ora di ritrovo è facoltativa: si scrive in \"Ora ritrovo\" (1730 o 17.30 diventano 17:30), oppure si tocca \"1 ora\", \"45 min\" o \"30 min\", che la contano dall'ora della partita; la X la toglie. Se un salvataggio si ferma con un errore, quello che avevi scritto resta nel modulo.",
      "Compaiono nel calendario pubblico insieme agli allenamenti, filtrabili per categoria. Ogni partita ha accanto l'etichetta piena della sua categoria, \"U14\" in verde acqua o \"U15\" in viola, in tutto il sito (calendario, elenchi dell'area tecnici, Scout, Pronostici, PDF); il calendario del telefono (\"Aggiungi al tuo calendario\") la mette davanti al titolo, e scegliendo una categoria sulla home aggiunge solo le partite di quella.",
      "La scheda di una partita (si apre toccandola nell'elenco) va dall'alto in basso come serve: \"Dettagli\" in breve (quando, dove, ritrovo, che partita è, la nota) con \"Modifica\"; a partita giocata il riquadro \"Risultato\", dove scrivi i parziali (o le partite di un torneo) e li salvi da soli con \"Salva risultato\" (\"Correggi\" li riapre); poi \"Convocazioni e formazioni\" (le assenze si gestiscono nella sezione \"Assenze\"). \"Modifica\" apre in una pagina a parte il modulo dei dettagli, con \"Elimina partita\" in fondo; salvando si torna alla scheda.",
      "Le notifiche push dicono che cosa è cambiato, e portano al calendario sul mese e sulla categoria della partita: \"Nuova partita\"; \"Cambio orario\" o \"Cambio data\" (con l'orario di prima), \"Cambio luogo\", \"Ritrovo aggiornato\", \"Nota sulla partita\" (o \"Cambiano orario e luogo\" se cambiano più cose); \"Vinta 3-1\" con i parziali quando salvi il risultato; \"Convocazioni pronte\" (o aggiornate) con quante sono e il ritrovo, mai i nomi, quando cambia la lista delle convocate; \"Partita tolta dal calendario\". Se salvi senza aver cambiato niente che interessi alle famiglie non parte nulla. Nel modulo dei dettagli, sotto \"Avvisa chi segue il calendario\", vedi in anteprima la notifica che partirà; il risultato e le convocazioni hanno il loro interruttore. Un nuovo avviso sulla stessa partita sostituisce sul telefono quello prima.",
      "Nella scheda di una partita si scelgono le convocate, poi si costruiscono le formazioni per ciascuno dei 5 set su un campo interattivo (ruoli S/OH/MB/OP/L e capitana): sono riservate allo staff e mai visibili sul sito pubblico.",
      "Due PDF diversi, dalla scheda della partita o dalla finestra delle convocazioni: \"Convocazioni\" (la partita, il ritrovo e chi è convocata con il numero di maglia, pronto da mandare a famiglie e atlete: non ci sono formazioni, note né assenze) e \"Formazioni\" (un campo per set, per lo staff). Per ognuno c'è \"PDF\" per scaricarlo e \"Condividi\" per mandarlo dal telefono. Dalla finestra, il PDF delle convocazioni segue le convocate che vedi in quel momento, anche se non hai ancora salvato; quello delle formazioni riporta l'ultima versione salvata, e se hai modifiche non salvate la finestra te lo dice.",
      "L'elenco \"Partite registrate\" mostra solo le partite già nel sito. Sopra l'elenco, il riquadro \"Portale FIPAV\" dice se il sito è allineato al calendario e ai risultati ufficiali della federazione e apre la pagina dedicata (anche dalla dashboard, quando c'è qualcosa da sistemare).",
      "La pagina \"Portale FIPAV\" mostra solo ciò che è diverso dal portale, diviso per tipo. \"Risultati da confermare\": partite giocate, \"Conferma risultato\" (o \"Conferma tutti\") compila i set con quelli ufficiali. \"Partite cambiate sul portale\": la federazione ha cambiato data, ora o avversaria di una partita che hai già; \"Aggiorna\" porta il sito a quello del portale (palestra compresa se cambia l'avversaria), ritrovo, note e convocazioni restano. \"Da verificare\": ogni riga fa una domanda, per esempio \"È la stessa partita?\" quando nel sito c'è una partita simile in un altro giorno (\"Sì: collega\" la aggiorna, \"No: aggiungila\" ne crea una nuova), una gara giocata che nel sito manca (\"Aggiungila con il risultato\"), un risultato che hai scritto diverso da quello ufficiale (resta il tuo: \"Tieni il mio\" o \"Usa quello ufficiale\") o una partita del sito che nel calendario ufficiale non c'è (collegala alla gara giusta, segnala come amichevole o eliminala). \"Da aggiungere al sito\": le partite del calendario ufficiale che non hai ancora inserito, già spuntate; è facoltativo e non viene segnalato come errore. In fondo c'è il calendario ufficiale completo con lo stato di ogni gara. \"Ignora\" toglie una gara dalle proposte (si ripristina da \"Gare ignorate\"); \"Aggiorna ora\" rilegge subito il portale.",
      "La classifica del girone, con tutte le squadre e il loro logo (per la nostra c'è lo stemma del sito), compare in fondo alla homepage pubblica insieme alla data dell'ultimo aggiornamento.",
      "\"Esporta PDF\" (in alto, accanto a \"Esporta CSV\") scarica il calendario di tutte le partite, pronto da stampare, con ritrovo, note e risultati; segue la categoria scelta nell'elenco. Anche chi visita il sito pubblico trova \"Scarica le partite (PDF)\" sotto il titolo della home: la stessa lista (convocazioni e formazioni non ci sono), con in più, per voi, \"Da inserire\" dove manca il risultato.",
    ],
  },
  {
    page: "partite",
    icon: CalendarX2,
    title: "Assenze",
    intro: "Le partite a cui un'atleta non ci sarà: le segnalano i genitori dal loro link personale, oppure tu. Solo U14/U15, per chi ha il permesso Partite.",
    points: [
      "Una sezione a sé, nel menu accanto a Partite, divisa in tre parti: \"Partite\", \"Link per i genitori\" e \"Regole\". Le assenze sono riservate allo staff: mai sul sito pubblico.",
      "Ai genitori si chiede solo questo: dal loro link personale toccano \"Non ci sarà\" (con un motivo e una nota, se vogliono), e chi non segnala niente ci sarà. Possono segnalarlo o annullarlo fino alla scadenza, scritta sotto ogni partita (di serie 5 giorni prima, alla stessa ora: partita sabato alle 18 → fino a lunedì alle 18); dopo, la partita resta visibile ma chiusa e devono scrivere a te.",
      "\"Partite\": per ogni partita in programma vedi come stanno le segnalazioni (\"Aperte fino a…\", \"Chiuse a mano\", \"Non chieste ai genitori\", \"Sospese\") e chi non ci sarà. Puoi: \"Chiudi adesso\" (da quel momento i genitori non possono più segnalare), \"Riapri fino all'inizio\", tornare alla \"Scadenza automatica\", \"Scegli la scadenza\" (giorno e ora, al più tardi l'inizio della partita), scrivere ai genitori un messaggio che compare sotto quella partita nella pagina del loro link, oppure togliere la spunta \"Chiedi ai genitori le assenze per questa partita\" (dal link non si vede più). Sotto ogni cambio c'è scritto chi l'ha fatto e quando. Anche i genitori vedono chi ha scritto, con il nome del suo account e mai come \"allenatore\": \"Da Gaga: …\" sull'avviso e sui messaggi, \"Segnalazioni chiuse da Gaga\", \"Segnata da Gaga\" su un'assenza scritta da voi.",
      "Toccando una partita (o \"Segna chi non ci sarà\") si apre la sua pagina: in alto le segnalazioni dei genitori con gli stessi comandi, sotto \"Chi non ci sarà\". Lì segni un'assenza con un tocco sul nome, aggiungi o cambi motivo e nota (\"Aggiungi motivo\" / \"Modifica\") o la togli (\"Ci sarà: togli\"), sempre, anche se l'ha scritta il genitore e anche a partita finita. Sotto ogni assenza c'è scritto chi l'ha segnalata e quando.",
      "Accanto alle partite, \"Ultime segnalazioni\" mostra le assenze più recenti; \"Promemoria per il gruppo\" prepara un messaggio con le partite ancora aperte e le loro scadenze (mai nomi né link) da copiare o mandare su WhatsApp.",
      "\"Link per i genitori\": per ogni atleta un link personale e segreto da mandare al genitore (\"Crea i link mancanti\", poi \"Copia link\" o \"WhatsApp\": con il permesso Trasferte WhatsApp si apre già sul numero del genitore preso dalla rubrica; il messaggio pronto dice i giorni delle regole di adesso). Il genitore non ha un account: apre il link e vede solo la sua atleta. La pagina ha due sezioni distinte, scelte da due schede in cima: \"Assenze alle partite\" (aperta di serie, con le prossime partite) e \"Certificato medico\". Ogni scheda dice lo stato in vista (\"2 assenze segnalate\", \"Scade tra 12 giorni\"…) e una pallina rossa avvisa quando nel certificato c'è qualcosa da fare. Se un link finisce dove non deve (per esempio in un gruppo), \"Rigenera\" lo sostituisce e il vecchio smette subito di funzionare: il nuovo va mandato di nuovo.",
      "\"Regole\": quanti giorni prima si chiudono da sole le segnalazioni (0 = all'inizio della partita) e a che ora (quella della partita o un'ora fissa), la pausa per tutte le partite (i genitori vedono le partite ma non possono segnalare) e un avviso che compare in cima alla pagina di ogni genitore. Per una partita sola si sceglie in \"Partite\".",
      "Fuori da questa sezione le assenze si vedono solo dove servono: nella finestra delle convocazioni un avviso rosso accanto a chi non ci sarà (non toglie nessuna dalle convocate da sola: decidi tu), e \"N non ci sono\" nell'elenco delle partite e nella dashboard.",
      "Se nel database manca qualcosa (per esempio la tabella delle assenze), la sezione lo dice; al Developer mostra l'SQL già pronto da copiare e incollare in Supabase (SQL Editor → Run).",
    ],
  },
  {
    page: "schede",
    icon: Puzzle,
    title: "Schede allenamento",
    intro: "Incolla il testo di un allenamento: l'IA lo divide da sola in blocchi.",
    points: [
      "Sull'allenamento desiderato incolli il testo così come lo scrivi di solito: l'IA capisce da sola dove inizia ogni parte dell'allenamento e ne prende titolo e durata, qualunque sia la formattazione (\"1. TITOLO – 10'\", \"A – 45' TITOLO\", sezioni con esercizi numerati dentro…). Gli esercizi che stanno dentro una parte restano nel suo blocco.",
      "Il contenuto di ogni blocco resta esattamente come scritto, senza modifiche: l'IA sceglie solo dove dividere. I blocchi si possono riordinare o rimuovere dalla scheda.",
      "Se una scheda già salvata è divisa male (un blocco che contiene pezzi di altri), in Schede premi \"Ricontrolla le schede con l'IA\" oppure, dentro la scheda, \"Ricontrolla con l'IA\": vedi la divisione attuale e quella proposta, e la applichi solo se ti va bene. Se l'IA non riesce a controllare qualche scheda (a volte è sovraccarica, oppure ha finito le richieste gratuite del giorno) te lo dice con i nomi delle schede e un pulsante \"Riprova\": quelle già controllate non vengono rifatte.",
      "Ogni volta che colleghi una scheda a un allenamento ti viene chiesto se renderla visibile alle atlete nel calendario pubblico: di default resta privata, allo staff. Puoi cambiare idea in qualsiasi momento dalla pagina di quell'allenamento.",
    ],
  },
  {
    page: "presenze",
    icon: ClipboardCheck,
    title: "Presenze",
    intro: "Registro presenze collegato agli allenamenti del calendario.",
    points: [
      "In \"Atlete\" si gestisce l'anagrafica: si possono aggiungere una alla volta o incollando un elenco insieme. Per U14/U15 c'è una categoria facoltativa (U14/U15, assegnabile anche dopo); per il Minivolley un gruppo facoltativo (CDA Lignano o CDA San Michele) — nell'elenco incollato il gruppo si scrive nella prima colonna di ogni riga, separata da una tabulazione da nome e cognome.",
      "Per U14/U15 ogni atleta può avere il numero di maglia (da 0 a 99): lo scrivi una volta sola qui e lo ritrovano da soli lo Scout e il Live score in modalità Partita. Si inserisce nella scheda di una nuova atleta (\"Numero di maglia\"), in \"Aggiungi in elenco\" scrivendolo prima o dopo il nome (\"7 Giulia Bianchi\" oppure \"Giulia Bianchi 7\": l'anteprima mostra come è stata letta ogni riga, e se incolli una atleta già presente con un numero diverso il numero si aggiorna) oppure direttamente nell'elenco, nella casella \"N°\" accanto al nome, che si salva da sola. Se un'altra atleta della stessa categoria ha già quel numero compare un avviso, non un divieto.",
      "Per U14/U15, dalla schermata principale si sceglie l'allenamento da registrare: ogni atleta è di default \"Presente\", con un tasto per segnarla \"Assente\" e, in quel caso, specificare se l'assenza è giustificata o no.",
      "Per il Minivolley invece si tocca solo chi era presente, raggruppate per CDA: nessuna assenza da segnare, chi non viene toccato resta semplicemente non registrato per quel giorno.",
      "Lo \"Storico\" mostra tutti i registri salvati (modificabili in ogni momento) e, per ogni atleta, la propria percentuale di presenza e la cronologia.",
      "In fondo a \"Atlete\", sotto \"Esporta PDF\", scarichi il riepilogo presenze da stampare: una riga per atleta con allenamenti, presenze, percentuale e (per U14/U15) assenze giustificate e non; in fondo la presenza media della squadra. L'elenco delle atlete e lo storico dei registri restano in CSV, perché sono dati da elaborare.",
      "Appena salvi un registro, l'elenco nominativo con lo stato di ciascuna atleta compare anche nel dettaglio di quell'allenamento sul calendario pubblico, visibile a chiunque senza bisogno di accedere. Per il Minivolley c'è anche una pagina pubblica dedicata (\"Presenze\" nell'header del sito Minivolley) con il conteggio delle presenze per atleta, raggruppato per CDA.",
    ],
  },
  {
    page: "testfisici",
    icon: Ruler,
    title: "Test fisici",
    intro: "Squat Jump, misure corporee e altri test per atleta, da confrontare nel tempo.",
    points: [
      "\"Nuovo test\" registra in un colpo solo le misure (peso e lunghezza delle gambe, già precompilate dall'ultima volta), i 3 Squat Jump e ogni altro dato libero. Ogni sessione si può correggere in seguito.",
      "In \"Atlete\" si apre il fascicolo di una atleta: tutte le sue sessioni e come cambiano misure e salti nel tempo.",
      "\"Riepilogo\" mette tutte le atlete in un'unica tabella, senza aprirle una a una. \"Ultimi risultati\" mostra per ognuna l'ultimo valore di ogni misura (con la data, se è di un altro giorno); \"Un giorno\" confronta le atlete provate lo stesso giorno; \"Tutte le sessioni\" le elenca di fila.",
      "Un clic sull'intestazione di una colonna ordina la tabella. Sotto ogni numero c'è la variazione rispetto alla misura precedente della stessa atleta; in verde il valore più alto di ogni salto. In fondo trovi la media di quello che vedi. \"Scarica CSV\" salva la tabella così com'è, per Excel; \"Scarica PDF\" la stampa in orizzontale con gli stessi filtri, lo stesso giorno e lo stesso ordine che vedi a schermo.",
    ],
  },
  {
    page: "livescore",
    icon: Volleyball,
    title: "Live score",
    intro: "Un tabellone punteggio dal vivo per allenamenti e partite, dal 2 contro 2 al 6 contro 6.",
    points: [
      "Prima di iniziare si sceglie il formato: Allenamento o Partita, la formula (\"3 set su 5\", \"2 set su 3\", \"3 set fissi\" oppure \"Libera\", senza limiti, di norma per l'allenamento), i punti (25 per set e 15 nell'ultimo, che si cambiano da \"Punti\": con i 3 set fissi il regolamento della gara stabilisce se il terzo va a 15 o a 25), con formazione o \"Solo punteggio\", quante giocatrici per squadra (da 2 a 6) e se si usa la libero. Il campo si dispone da solo: a 2 affiancate, a 3 a triangolo (una a rete e due dietro), a 4 a rombo, a 5 e a 6 su due file; nel 2 contro 2 la libero non c'è. L'ultimo formato scelto resta pronto per la volta dopo. Si usa anche dal telefono (il campo è piccolo ma leggibile), e da computer le frecce ← e → segnano il punto della squadra a sinistra o a destra, Backspace annulla.",
      "Su tablet in orizzontale e computer (da 1024 px di larghezza) la partita si dispone su tre colonne: in alto il tabellone, con i punteggi grandi e la striscia di stato; sotto, ai lati del campo, il pulsante dei punti di ciascuna squadra con i suoi time-out e i suoi cambi; in mezzo il campo, più piccolo, con le azioni della partita (\"Annulla\" scuro, \"Cambio\" azzurro, \"Chiudi set\" verde, \"Inverti\" viola, \"Formazioni\" verde acqua, \"Diretta\" rosa, \"Nuovo\" rosso perché cancella la partita: ogni azione ha il suo colore e lo conserva ovunque compaia, quindi il time-out è sempre giallo e i cambi sempre azzurri). \"Schermo intero\" (in alto a destra) lo mette a tutto schermo e lì entra tutto senza scorrere. Da telefono e da tablet in verticale resta una colonna sola, con le azioni in alto. Anche l'impostazione si divide in due: i dati e \"Inizia\" a sinistra, il campo con le formazioni a destra.",
      "Con la formazione si scrivono le posizioni da 1 a 6 come nel foglio di posizione (la 1 batte, poi si ruota in senso orario); scrivendo un numero e premendo Invio si passa alla posizione dopo. In Partita, se hai già preparato la formazione in \"Partite\", il pulsante \"Usa la formazione salvata del 1° set\" la porta qui con la libero e le centrali. Da lì il tabellone calcola da solo la rotazione (ruota solo la squadra che conquista la battuta) con qualunque numero di giocatrici, e fa entrare e uscire la libero: la libero non batte mai, quindi se in battuta c'è una centrale batte lei e la libero entra quando la squadra riceve; esce quando la centrale ruota a rete. Se lo stesso numero finisce in due posizioni, o la libero ha il numero di una giocatrice in campo, le caselle diventano rosse, una scheda dice cosa correggere e \"Inizia\" (come \"Fatto\" nelle formazioni) resta bloccato finché non è tutto a posto; nei menù i numeri già usati non si possono scegliere due volte. Con \"Solo punteggio\" non c'è il campo e non si segue chi batte: si segnano solo punti, set e time-out, con pulsanti più grandi.",
      "Sotto il tabellone una striscia dice a che set sei e a quanti punti finisce (25, il set decisivo 15, sempre con due punti di scarto), chi batte adesso con la giocatrice in posizione 1, chi batterebbe se ricevesse e vincesse lo scambio, e quando una squadra ha il set point o il match point. Un pallone verde sulla posizione 1 della squadra che batte la rende riconoscibile anche sul campo.",
      `Quando un set è vinto compare la scheda \"Chiudi il set\" e i pulsanti dei punti si fermano: un tocco chiude il set e prepara il successivo da solo: ogni squadra torna alla formazione con cui aveva cominciato (anche se nel set c'erano state rotazioni e cambi), la battuta passa all'altra squadra e la libero va al posto giusto. I campi si cambiano ogni 2 set (dalla stagione ${RULES_SEASON}): il 2° set si gioca sugli stessi campi del 1° e dal 3° sono invertiti; con \"Libera\" si cambia ancora dopo il 4°, il 6° e così via. \"Inverti\" li scambia a mano se in campo è andata diversamente. All'inizio di ogni set una scheda ti lascia correggere chi batte per primo, controllare le formazioni o usare quella salvata per quel set. Nel set decisivo (il 5° al meglio dei 5, il 3° al meglio dei 3) campo e battuta si sorteggiano: i campi restano quelli del set prima finché non scegli (se il sorteggio li cambia usa \"Inverti\"), poi scegli tu chi batte per primo e i punti si sbloccano; a 8 punti compare l'avviso del cambio campo. Con 3 set fissi si giocano sempre tutti e tre; con \"Libera\" non c'è nessun limite e chiudi i set a mano.`,
      `Durante il gioco, \"Cambio\" (o un tocco sulla giocatrice in campo, o sul contatore dei cambi accanto ai time-out) apre la sostituzione: scegli chi esce e chi entra, dalle atlete in panchina o scrivendo nome o numero. Il tabellone conta i cambi di ogni set (nel 6 contro 6 ne sono previsti ${SUBSTITUTIONS_PER_SET} per set dalla stagione ${RULES_SEASON}, prima erano 6), chi entra continua la rotazione al posto di chi è uscito e, se era una di quelle sostituite dalla libero, ne prende il ruolo. Se il cambio non rispetta le regole (una titolare esce e rientra una volta sola per set, e rientra solo al posto di chi l'ha sostituita, ovunque questa si trovi in campo in quel momento; una riserva entra una volta sola per set ed esce solo per la titolare per cui è entrata; al massimo ${SUBSTITUTIONS_PER_SET} cambi) compare un avvertimento: puoi confermare lo stesso, per esempio per un infortunio. Per far rientrare una titolare scrivi il suo nome o toccala in panchina (porta l'etichetta \"rientra\"): \"Esce\" si imposta da solo sulla sua sostituta, nella posizione in cui si trova adesso. \"Annulla\" toglie anche un cambio sbagliato; \"Formazioni\" resta per correggere un nome senza contarlo come cambio.`,
      `Time-out: ogni squadra ne ha ${TIMEOUTS_PER_SET} per set e ognuno dura ${TIMEOUT_SECONDS} secondi (regole ${RULES_SEASON}). \"Time-out\", accanto al pulsante dei punti di ogni squadra (da telefono nel tabellone), lo segna e fa partire un conto alla rovescia di ${TIMEOUT_SECONDS} secondi, grande, sotto il tabellone: diventa arancione negli ultimi 10 secondi e a zero suona due volte (l'altoparlante accanto al conto spegne il suono), resta rosso qualche secondo e si chiude da solo. \"Fine time-out\" lo chiude prima, e si chiude anche se segni un punto. Il terzo tocco su \"Time-out\" azzera il conteggio della squadra (serve a correggere un errore) e non fa partire niente.`,
      `Regole della stagione ${RULES_SEASON}: dal 28 settembre 2026 la FIPAV applica in tutte le gare le Regole di Gioco con le sperimentazioni \"FIVB Rule Tests 2026\". Per il punteggio e le formazioni cambia questo: le squadre cambiano campo ogni 2 set (dopo il 2°, non più dopo ogni set; il set decisivo ha il suo sorteggio e il cambio a 8 punti), ${SUBSTITUTIONS_PER_SET} sostituzioni per set (prima 6; restano le limitazioni della regola 15.6: una titolare può uscire e rientrare una volta sola per set, ma solo al posto di chi l'ha sostituita, e una riserva entra una volta sola ed esce solo per la titolare per cui è entrata) e ${TIMEOUTS_PER_SET} time-out da ${TIMEOUT_SECONDS} secondi per squadra e per set. Live score e Scout usano già queste regole; il resto (attacchi accompagnati, palla sul soffitto, riscaldamento di 90 secondi alla battuta) riguarda gli arbitri.`,
      "In modalità Partita si usano i numeri di maglia e si sceglie il nome e il colore dell'avversaria (o si collega una partita di oggi del calendario, che li scrive da sola); in Allenamento si usano direttamente i nomi.",
      "Per le nostre giocatrici, in Partita, il numero non si riscrive ogni volta: si sceglie da un elenco \"numero · nome\" (prima le convocate della partita collegata, poi le altre atlete della categoria) con i numeri scritti in Presenze > Atlete; \"Altro...\" permette un numero qualsiasi. Gli stessi numeri sono la panchina quando si fa un cambio.",
      "Solo in Partita, un admin può accendere la diretta (\"Diretta sul sito pubblico\" prima di iniziare, o il pulsante \"Diretta\" durante il gioco): sul sito pubblico compare il riquadro \"In diretta\" con squadre, punti, set, chi batte e time-out usati, aggiornato ogni pochi secondi e indicato come risultato non ufficiale. Nomi, numeri di maglia e formazioni non si vedono mai. Si spegne con lo stesso pulsante, con \"Nuovo\" o da sola dopo 3 ore.",
      "Punteggio, set, formazioni e stato della libero restano salvati finché non si preme \"Nuovo\" (al massimo 3 ore).",
    ],
  },
  {
    page: "scout",
    icon: Binoculars,
    title: "Scout",
    intro: "Segni la partita scambio per scambio, al livello che scegli prima di ogni partita: ne esce il tabellino, come nei campionati ufficiali.",
    points: [
      "Se è la prima volta, in cima all'elenco \"Scout\" trovi \"Prima volta con lo Scout?\": \"Avvia la guida\" ti accompagna passo passo su una partita vera, dalla preparazione al tabellino, spiegando ogni pulsante. La guida resta sempre dietro al punto interrogativo in alto a destra di ogni pagina dello Scout. \"Manuale d'uso (PDF)\" (in cima all'elenco e accanto al punto interrogativo) scarica il manuale completo, con le schermate commentate, gli esempi tocco per tocco, il glossario e una scheda rapida da stampare per il bordo campo. \"Condividi PDF\", accanto al manuale, lo manda come file: dal telefono si apre il foglio di condivisione con il PDF già allegato (WhatsApp, e-mail, \"Salva su File\"), dal computer il file si scarica e lo puoi allegare dove vuoi.",
      "Si apre dall'elenco \"Scout\": ogni partita di campionato o amichevole di U14/U15 ha il suo scout (i tornei e il Minivolley non ce l'hanno). \"Segna i punti\" comincia, \"Continua\" riprende una partita lasciata a metà, \"Tabellino\" e \"PDF\" aprono i risultati.",
      "Prima di ogni partita scegli il livello, in cima alla preparazione (\"Quanto vuoi segnare?\"): \"Base\" segna come finisce ogni scambio, \"Con ricezioni\" aggiunge la nostra ricezione (chi ha ricevuto, con che voto e, se vuoi, la zona). Si cambia anche a partita iniziata da \"Squadre e regole\": quello che hai già segnato resta. Le partite segnate prima dei livelli valgono come Base; quelle segnate col vecchio livello \"Completo\" (ogni tocco) si leggono come Con ricezioni, con tutti i loro punti.",
      "Prima di cominciare scegli chi gioca: spunta le atlete (le convocate sono già in cima) e segna la libero con la \"L\". Il numero di maglia arriva da solo dall'anagrafica (Presenze > Atlete): puoi cambiarlo solo per questa partita e, se manca, \"Usa il 7\" o \"Compila i numeri dall'anagrafica\" lo prendono da lì. Poi i numeri dell'avversaria (basta scriverli di seguito, \"1 4 7 9 12\") e le regole: 3 set su 5, 2 su 3 o 3 fissi, i punti per set (25) e dell'ultimo set (15), e chi batte per primo. Si può cambiare tutto anche dopo, ma non togliere chi ha già un'azione.",
      `Formazione in campo (facoltativa, per tutti i livelli): nella preparazione, subito sotto «Le nostre giocatrici», la scheda \"Formazione in campo\" funziona come nel Live score. Scegli chi gioca nelle posizioni da 1 a 6 (la 1 batte, poi si ruota in senso orario), la libero e le due giocatrici che sostituisce (le centrali); per l'avversaria scrivi i numeri e premi Invio per passare alla posizione dopo. Se hai preparato la formazione in \"Partite\" la trovi già scritta, e \"Comincia a segnare i punti\" la applica da sola portando in rosa chi manca: niente da riscrivere. Altrimenti scrivila e premi \"Conferma la formazione\". Da quel momento sopra i pulsanti compare \"In campo\" con le due squadre: ruotano da sole quando una squadra conquista la battuta (la 1ª rotazione è quella di partenza), la libero entra al posto della centrale in seconda linea e non batte mai, un pallone verde segna chi batte. Chi segni (\"chi\") si sceglie dal campo: la rete in alto, davanti 4-3-2 e dietro 5-6-1, la libero in scuro e il pallone verde su chi batte; tocchi la giocatrice dove sta e la panchina è sotto, più chiara (a muro la libero non si sceglie e la seconda linea è più chiara). \"Cambio\" apre la sostituzione: \"chi esce\" lo tocchi sul campo, dove sta davvero (davanti 4-3-2, dietro 5-6-1, con numero e nome), poi \"chi entra\", e prima di confermare leggi il cambio a parole (con avvertimento se non è regolare: al massimo ${SUBSTITUTIONS_PER_SET} per set; una titolare uscita rientra una volta sola, al posto di chi l'ha sostituita, ovunque questa sia in campo adesso, e in \"Chi entra\" la trovi con l'etichetta \"rientra\"); i cambi si vedono nel Registro, dove si possono togliere. \"Cambia la libero\", dentro lo stesso Cambio, mette un'altra libero senza contare tra i cambi del set (non è un cambio ufficiale). A ogni set nuovo si apre da sola la finestra \"Formazione del 2° set\" (e così via): è già scritta come l'hai preparata in \"Partite\" per quel set, oppure come quella del set prima, quindi basta \"Conferma e comincia\"; se cambia, correggi le posizioni (\"Come nel set precedente\" e \"Usa la formazione salvata\" riportano indietro). Il pulsante \"Formazione\" in \"In campo\" la riapre in qualunque momento. Se non la segui, sopra i pulsanti compare un avviso con \"Imposta la formazione\" (e c'è \"Segui la formazione\" sotto i pannelli): finché non la imposti, per ogni punto scegli tra tutte le giocatrici. Il tabellino mostra le formazioni di partenza e i cambi di ogni set; nel foglio (anche in PDF) c'è da dove è partita ognuna in ogni set. \"Schermo intero\" (in alto) mette lo Scout a tutto schermo: su tablet e computer si divide in due colonne, con i pulsanti per segnare a sinistra (grandi, a tutta altezza, con \"Annulla ultimo\" sempre in fondo) e il tabellone (sempre in alto), chi è in campo e il registro (che scorre da solo) a destra; si esce con \"Esci\" o con Esc.`,
      "Da che parte è la palla (tutti i livelli): sopra i pulsanti c'è il campo visto dall'alto, \"Noi\" a sinistra e \"Loro\" a destra con la rete in mezzo. All'inizio di ogni scambio la palla sta dalla parte di chi batte; con le ricezioni, segnata la nostra ricezione, passa dalla nostra parte. La stessa palla si accende sul tabellone accanto al nome della squadra, e la fascia resta in vista sotto l'intestazione mentre scorri fino ai pulsanti. Nel livello Con ricezioni una striscia a tre passi (battuta, ricezione, punto) dice a che punto sei.",
      "Livello Base: per ogni scambio tocchi come è finito, nella colonna di chi ha fatto punto: \"Punto nostro\" a sinistra, \"Punto loro\" a destra. Attacco, Muro, Ace, oppure l'errore dell'altra squadra (battuta, ricezione, attacco, errore a muro, alzata o difesa sbagliata, e i falli fischiati: tocco di rete, invasione, doppia, trattenuta, quattro tocchi, rotazione, sanzione). Poi scegli chi l'ha fatto: bastano due tocchi. Se non lo sai, \"Non so\". Fa eccezione l'Attacco di \"Punto loro\": una loro schiacciata a terra si segna subito, con un tocco solo, senza chiedere chi.",
      "Dopo un muro puoi dire anche chi attaccava (si conta come attacco murato). Rotazione e sanzioni sono della squadra, quindi non chiedono chi. La libero non può murare, per questo non compare tra le scelte del muro. Un numero avversario che manca lo scrivi direttamente nella finestra di scelta.",
      "Con ricezioni: quando batte l'avversaria si apre da sola la finestra \"Ricezione nostra\", come quelle dei pulsanti dei punti: se segui la formazione a sinistra c'è il campo, dove tocchi chi ha ricevuto (la panchina e \"Non so\" sono sotto; senza formazione, una riga di numeri), a destra i voti. Tocchi chi ha ricevuto, il voto (# perfetta, + positiva, ! neutra, - negativa, / scarsa, = errore) e, se vuoi, la zona del campo; poi la finestra si chiude. Se non vuoi segnarla, \"Salta la ricezione\" (o Esc) la chiude e segni solo il punto: in pagina resta la riga \"Ricezione nostra\" con \"Segna la ricezione\" per riaprirla. Con l'errore (=) lo scambio si chiude da solo con il punto per loro; con gli altri voti segni il punto come nel Base. Se la palla cade senza essere toccata è un ace di chi batte, non una ricezione sbagliata. La segni prima del punto; se te ne dimentichi, la aggiungi dal Registro.",
      `Time-out (tutti i livelli): sotto il punteggio del tabellone ogni squadra ha il suo pulsante \"Time-out\" (${TIMEOUTS_PER_SET} per set, ${TIMEOUT_SECONDS} secondi l'uno, regole ${RULES_SEASON}), con due pallini che si riempiono: toccalo quando una squadra lo chiede; finiti i due, il pulsante si spegne fino al set dopo. Non cambia punteggio né battuta; compare nel Registro con il punteggio del momento (lo togli con il cestino) e, se il punteggio live è acceso, sul riquadro \"In diretta\" del sito. Nello Scout il time-out si conta soltanto: il conto alla rovescia di ${TIMEOUT_SECONDS} secondi c'è nel Live score.`,
      "\"Annulla ultimo\" toglie l'ultima cosa segnata: un punto, un set chiuso, un time-out o, con le ricezioni, la ricezione appena segnata. Per un errore più indietro tocca la matita nel \"Registro\": cambi chi, come e a chi, oppure togli lo scambio; con le ricezioni cambi anche chi ha ricevuto, voto e zona, la togli o aggiungi quella dimenticata. Punteggio e battuta si ricalcolano da soli.",
      "Quando un set arriva al limite con due punti di scarto compare da solo il pulsante per chiuderlo, dove scegli chi batte per primo nel set dopo (di norma si alternano). A partita decisa i pulsanti si fermano. \"Chiudi il set adesso\" e \"Chiudi la partita\" servono per i casi particolari (partita interrotta, set non finito); la partita chiusa a mano si può riaprire.",
      "Si salva da solo: in alto vedi \"Salvato\". Se cade la rete (o il server non risponde) puoi continuare: i punti restano nel telefono, un avviso giallo dice quanti non sono ancora sul server (con \"Riprova adesso\" e \"Scarica una copia\") e partono appena torna la connessione. Se la risposta del server si perde, o due dispositivi segnano in momenti diversi, le versioni si uniscono da sole; ti chiede quale tenere solo se hanno segnato cose diverse negli stessi momenti, e quella che non scegli resta nelle copie. A ogni set chiuso e a ogni versione sostituita il dispositivo mette da parte una copia: in \"Squadre e regole\" → \"Copia di sicurezza\" la ripristini, la scarichi come file o rimetti un file.",
      "Il punteggio live sul sito pubblico si accende anche dallo Scout: con l'interruttore \"Mostra il punteggio sul sito pubblico\" nella preparazione, oppure con \"Punteggio live sul sito\" sotto i pannelli durante la partita (in alto compare la targhetta \"Live sul sito\"; lo stesso pulsante lo spegne). Il sito mostra solo squadre, punti, set, chi batte e i time-out usati nel set (quelli del pulsante \"Time-out\" sotto il punteggio), come risultato non ufficiale, dal primo punto segnato: mai nomi o numeri di maglia, chi ha fatto punto, errori o tabellino. Sparisce da solo tre ore dopo l'ultima modifica dello scout. Se sono accesi sia lo Scout sia il Live score, il sito mostra quello aggiornato per ultimo.",
      "Il tabellino è fatto come quelli delle leghe: in alto il campionato, le due squadre con i set vinti, data, orario e impianto, e i set con durata, parziali (il punteggio a 8, 16 e 21) e finale. Poi una tabella per squadra con tutta la rosa: da dove è partita ognuna in ogni set (o se è entrata), punti (con i break point e il saldo vinti meno persi), battuta, ricezione, attacco e muro, i totali e i punti vinti set per set (ace, attacco, muro, errori dell'avversaria); in fondo i punti in ogni rotazione, quante ricezioni servono per un punto e quante battute per un break point, e (con ricezioni) il cambio palla dopo una ricezione positiva o negativa. Lo zero è un punto, il trattino vuol dire che a quel livello non si segna. Vale anche per le partite già scoutizzate. Sotto ci sono le analisi, per tutta la partita o per un set: come ha fatto punto ogni squadra, errori e falli, andamento del punteggio, punti in battuta e cambio palla; con ricezioni la scheda della ricezione (positiva e perfetta in percentuale, una barra per giocatrice, quanto la ricezione fa vincere lo scambio e la mappa delle zone). Il PDF è solo il tabellino, il foglio come quelli delle leghe (A4 verticale, sempre su tutta la partita): le analisi restano nella pagina. \"Stagione\" somma tutte le partite scoutizzate: la ricezione conta però solo quelle in cui l'hai segnata. Il filtro \"Tutte / Under 14 / Under 15\" accanto a \"Partite\" e \"Stagione\" vale per tutte e due le viste: con una categoria scelta vedi le partite, i totali e le giocatrici di quella soltanto.",
      "Lo scout segna come finisce ogni scambio, non ogni tocco: per questo non ci sono gli attacchi tentati e le percentuali di attacco dei tabellini di Lega; ricezioni totali e percentuali di ricezione le dà il livello Con ricezioni. I numeri sono sempre quelli che segni: un tocco saltato non compare. La durata dei set è una stima, dall'ora del primo all'ultimo punto segnato.",
    ],
  },
  {
    page: "scout",
    icon: Video,
    title: "Diretta video",
    intro:
      "Far vedere la partita ai genitori in diretta, con il punteggio dello Scout sopra il video. Due strade: dal computer con Streamlabs Desktop (la grafica entra nel video e ai genitori basta il link di YouTube) oppure solo con i telefoni (il punteggio lo disegna la pagina /diretta del sito).",
    points: [
      "In ogni caso serve un canale YouTube con le dirette attivate. Si fa una volta sola, da computer (studio.youtube.com > Crea > Vai in diretta, con la verifica del numero di telefono) e YouTube può metterci fino a 24 ore: fallo con anticipo, perché finché non è attivo nessun programma e nessuna app può andare in diretta. Il video passa da YouTube, non dal sito: nessun peso su Vercel né su Supabase.",
      "Il punteggio: accendi \"Punteggio live sul sito\" nello Scout (nella preparazione o sotto i pannelli). La grafica compare subito, a 0–0, e poi segue la partita: in alto a sinistra la barra piccola (categoria, set, chi batte, time-out usati, set vinti, punti, parziali, SET POINT e MATCH POINT) e in basso la barra larga come in TV, con i due loghi, i set vinti e i punti del set; sotto la piccola le strisce \"Time-out\" con i 30 secondi e \"Finale\". A fine set compare il resoconto: parziale, durata e numeri di squadra del set (attacchi vincenti, muri, ace, errori dell'avversaria, serie di punti più lunga, time-out). Mai nomi né numeri di maglia: solo totali di squadra. Il logo dell'avversaria viene dalla classifica del girone (per chi non è nel girone, amichevoli e tornei, ci sono le iniziali). Il riquadro \"In diretta\" della home del sito compare invece dal primo punto segnato, e mostra anche il logo.",
      "Strada A, dal computer con Streamlabs Desktop (gratis, per Windows e Mac): è OBS con un'interfaccia più guidata, e la grafica entra nel video. Una volta sola: installalo da streamlabs.com, avvialo e accedi con l'account Google del canale YouTube (così non servono chiavi). Nel riquadro delle fonti (\"Sources\") premi + e aggiungi la camera (\"Video Capture Device\", cioè la webcam del computer) e, per ultima, la grafica: una fonte \"Browser Source\" con indirizzo https://volley-lignano.vercel.app/diretta/grafica, larghezza 1920 e altezza 1080 (nella scheda \"Diretta video\" dello Scout c'è il pulsante per copiare l'indirizzo). La grafica deve stare in cima all'elenco delle fonti, sopra la camera. OBS Studio funziona allo stesso modo. I nomi delle voci possono cambiare un po'.",
      "Un telefono su cavalletto come camera (con VDO.Ninja: gratis e senza installare niente). Scegli un nome per la camera, solo lettere minuscole e numeri (per esempio lignanocampo4829). Sul telefono, in orizzontale e in carica, apri https://vdo.ninja/?push=lignanocampo4829 con Safari (iPhone) o Chrome (Android), consenti fotocamera e microfono, scegli la fotocamera posteriore e premi il pulsante di avvio. Nel programma aggiungi, sotto la grafica, una fonte \"Browser Source\" con indirizzo https://vdo.ninja/?view=lignanocampo4829, 1920×1080, e spunta \"Control audio via OBS\" per l'audio: il nome deve essere uguale nei due indirizzi, maiuscole comprese. Sul telefono non far spegnere lo schermo (Impostazioni > Schermo > Blocco automatico: Mai) e lascia la pagina aperta. Con più telefoni ogni camera ha il suo nome.",
      "Prova a casa, prima della partita (dieci minuti): metti ?prova=1 in fondo all'indirizzo della grafica (https://volley-lignano.vercel.app/diretta/grafica?prova=1) e guarda l'anteprima del programma: una partita finta si muove da sola, con le due barre, time-out, fine set con il resoconto e finale. Se la vedi, la parte difficile è fatta; poi togli ?prova=1. Con ?stile=piccola (solo la barra in alto) o ?stile=larga (solo quella in basso) tieni una barra sola; con ?posizione=alto-destra (o basso-sinistra, basso-destra) e ?scala=120 sposti e ingrandisci la barra piccola.",
      "Alla partita: accendi \"Punteggio live sul sito\" nello Scout (la barra compare subito nell'anteprima, a 0–0) e nel programma premi \"Go Live\": scrivi un titolo (per esempio \"Volley Lignano – Degano\") e, se la finestra lo chiede, scegli \"Non in elenco\". Prima di mandare il link controlla in YouTube Studio > Contenuti > Dal vivo che la visibilità sia \"Non in elenco\". Il link della diretta lo mandi ai genitori su WhatsApp: vedono il video con la grafica già dentro, non serve la pagina /diretta. A fine partita termina la diretta dal programma e spegni \"Punteggio live sul sito\".",
      "Se nell'anteprima la barra non c'è: controlla che \"Punteggio live sul sito\" sia acceso e che in alto nello Scout compaia \"Salvato\" (la grafica rilegge il punteggio ogni 2 secondi). Poi apri l'indirizzo della grafica in un normale browser: se la barra si vede lì, il problema è la fonte nel programma (indirizzo, larghezza, altezza); se non si vede, il punteggio live non è ancora arrivato al sito.",
      "Strada B, solo con i telefoni, senza computer: ogni telefono su cavalletto fa la sua diretta su YouTube, tu incolli i link nella scheda \"Diretta video\" (in cima all'elenco Scout) e i genitori aprono sempre lo stesso indirizzo, https://volley-lignano.vercel.app/diretta: vedono il video con la barra del punteggio sopra e, se le camere sono più d'una, scelgono con un pulsante quale guardare. Il punteggio si vede solo da questa pagina: aprendo il link di YouTube direttamente c'è il video senza grafica. Servono telefoni su cavalletto e in carica, con il display sempre acceso e una buona connessione (circa 3 Mbit/s in invio, cioè 1,3 GB l'ora).",
      "Su ogni telefono, senza i 50 iscritti (Larix Broadcaster, gratis; i nomi delle voci possono cambiare un po'). Una volta sola, da computer: in YouTube Studio > Crea > Vai in diretta, scegli la trasmissione con un software e copia \"URL stream\" e \"Chiave stream\". Sul telefono installa Larix Broadcaster, apri Impostazioni > Connessioni > Nuova connessione, scrivi un nome e nell'URL incolla l'URL stream, una barra e la chiave (per YouTube: rtmp://a.rtmp.youtube.com/live2/LA-TUA-CHIAVE); nelle impostazioni del video scegli circa 720p a 30 immagini al secondo e 3000 kbps. A ogni partita: tocca il cerchio rosso per trasmettere e, quando in YouTube Studio compare l'anteprima, premi \"Vai in diretta\"; scegli \"Non in elenco\" e spegni commenti e chat. Con più telefoni serve una chiave per ognuno: prova prima di una partita. Poi copia il link della diretta (Condividi > Copia link) e incollalo nella scheda.",
      "Con 50 iscritti o più si fa tutto dall'app di YouTube: Crea > Vai in diretta, \"Non in elenco\", commenti e chat spenti, un titolo (per esempio \"Volley Lignano – Degano · Campo\"), poi Condividi > Copia link.",
      "Nello Scout, scheda \"Diretta video\" (in cima all'elenco): per ogni camera scrivi un nome (Campo, Dietro, Panchina) e incolla il link, poi \"Salva\". Il ritardo del punteggio parte da 15 secondi: YouTube mostra il video con 10–20 secondi di ritardo, e il punteggio compare dopo altrettanto. Se arriva prima del punto nel video, aumentalo; i genitori lo regolano anche da soli con − e + sotto il video.",
      "Ai genitori manda su WhatsApp il link della scheda (\"Copia il link per i genitori\"): è sempre lo stesso, lo possono salvare. Prima che la diretta cominci la pagina dice \"La diretta non è ancora iniziata\" e il video compare da solo.",
      "A fine partita: \"Svuota\" nella scheda (i link scadono comunque da soli dopo 12 ore), termina le dirette su YouTube e spegni \"Punteggio live sul sito\".",
      "Strada B, la prova di dieci minuti prima della partita: una diretta di prova \"Non in elenco\", i link nella scheda, la pagina /diretta aperta su un altro telefono. Controlla video, punteggio (segna un punto e poi \"Annulla ultimo\") e ritardo.",
      "Minorenni: serve la liberatoria dei genitori per riprendere e pubblicare, e conviene avvisare la società ospite e l'arbitro (verifica con la società: qui non c'è un parere legale). Diretta \"Non in elenco\" con i commenti spenti; la grafica non mostra nomi, ma l'audio sì: la panchina si sente.",
      "Quanto pesa sul piano gratuito: il video non passa da Vercel né da Supabase. La pagina dei genitori legge il punteggio (poche centinaia di byte, tenuti 3 secondi dalla rete di Vercel) ogni 8 secondi finché è aperta e visibile, e le camere una volta al minuto; con Streamlabs la grafica lo legge ogni 2 secondi dal computer, una lettura sola.",
    ],
  },
  {
    page: "pronostici",
    icon: Target,
    title: "Pronostici",
    intro: "Pronostica il punteggio di ogni set insieme al resto dello staff.",
    points: [
      `Tutte le partite della stagione sono visibili fin da subito, ma si può pronosticare solo a partire dal giorno in cui si gioca. I pronostici restano aperti fino a ${PREDICTION_GRACE_LABEL} dopo l'inizio della partita (la pagina indica l'orario di chiusura) e si chiudono prima solo se il risultato è già stato inserito. Dopo la chiusura i pronostici di tutti diventano visibili.`,
      "Chi si avvicina di più al risultato reale di un set vince il set: i punti totalizzati compongono la classifica.",
      "Anche le partite dei tornei si pronosticano, una gara alla volta.",
      "Ogni partita porta l'etichetta U14 o U15; il filtro \"Tutte / Under 14 / Under 15\" sopra l'elenco mostra una categoria sola (la classifica resta su tutte le partite).",
    ],
  },
  {
    page: "certificati",
    icon: Stethoscope,
    title: "Certificati medici",
    intro: "Per ogni atleta se il certificato medico è valido, dal giorno della visita e dalla foto che manda il genitore. Solo U14/U15, per chi ha il permesso «Certificati medici».",
    points: [
      "Il permesso «Certificati medici» non ce l'ha nessun account di partenza, nemmeno i nuovi Admin: il Developer lo dà dal Centro di controllo, tra le pagine dei permessi.",
      "Il genitore, dal suo link personale (lo stesso delle assenze, nella scheda \"Certificato medico\"), sceglie con il calendario del telefono il giorno della visita e carica una foto del certificato (\"Scatta o scegli una foto\": il telefono la rimpicciolisce prima di mandarla e ne mostra l'anteprima). Il certificato dura sempre un anno, quindi la scadenza la calcola il sito (visita il 12 marzo 2026 → valido fino al 12 marzo 2027) e si vede subito, prima di salvare.",
      "La foto la vede solo lo staff con questo permesso (\"Vedi la foto\" la apre): mai il sito pubblico, e nemmeno il genitore la rivede dalla sua pagina (vede solo che è caricata). Con una visita nuova la foto di prima va via: va caricata quella del certificato nuovo.",
      "Il sito dice da solo se è valido: \"Valido\" (verde), \"Scade tra N giorni\" (rosso, da un mese prima della scadenza: è ancora valido ma va rinnovato), \"Scaduto\" (rosso, non valido) e \"Da inserire\" (senza la data non risulta valido). Per ognuna una barra mostra l'anno di validità, dalla visita alla scadenza, con l'ultimo mese in rosso e un punto su oggi; sotto c'è scritto se la foto c'è (\"Foto caricata\") o no (\"Senza foto\").",
      "In alto i riquadri con quanti sono scaduti, in scadenza, senza data e validi. Sotto, in cima \"Da rinnovare\" (scaduti e in scadenza, dal più urgente), poi \"Senza data\" e \"In regola\". Quando ce n'è almeno uno da rinnovare lo dice anche la dashboard.",
      "\"Avvisa il genitore\" apre WhatsApp con il messaggio già scritto (cosa succede e il link, che apre già la scheda del certificato, per scegliere il giorno della visita nuova e caricare la foto); per un certificato in regola senza foto il pulsante è \"Chiedi la foto\". Con il permesso Trasferte WhatsApp si apre già sul numero del genitore preso dalla rubrica. \"Copia\" copia lo stesso messaggio. Se l'atleta non ha ancora il link (si crea in Assenze → Link per i genitori), nel messaggio non c'è il link.",
      "Data e foto le puoi mettere o correggere anche tu (\"Inserisci data e foto\" / \"Cambia data o foto\"), togliere la sola foto (\"Togli la foto\") o tutto (\"Togli data e foto\"). Sotto ogni atleta c'è chi ha scritto la data e chi ha caricato la foto, il genitore o il nome del tuo account, e quando.",
      "Eliminando un'atleta vanno via anche il suo certificato e la foto. In modalità prova lavori su una copia, che sparisce all'uscita.",
    ],
  },
  {
    page: "trasferte",
    icon: Car,
    title: "Trasferte",
    intro: "Mezzi, posti e chi va con chi per le partite fuori casa. Sezione super riservata.",
    points: [
      "La vede solo chi ha il permesso «Trasferte»: nessun account ce l'ha di partenza, nemmeno i nuovi Admin. Il Developer la apre a un account dal Centro di controllo, tra le pagine dei permessi. Esiste solo per U14/U15.",
      "Ogni partita fuori casa (inserita in Partite con «Trasferta») ha la sua scheda. Nell'elenco vedi a che punto sei: quanti mezzi ci sono e quante convocate hanno già un passaggio. Le convocate sono quelle scelte nella partita; se non ce ne sono, la scheda te lo dice.",
      "Mezzi: auto, pulmino, pullman o altro. Per ognuno scrivi di chi è (la famiglia che lo presta, la società: lascia vuoto se è di chi guida), chi guida, il suo numero, i posti per le atlete (chi guida non conta) e, se serve, ora e luogo di partenza e una nota. Quelli già usati in altre trasferte si rimettono con un tocco da «Già usati altre volte».",
      "Il mezzo si vede dall'alto, con un riquadro per ogni posto, e si cambia da lì: con + e − i posti (mai meno di chi c'è già sopra), con la matita o toccando il volante chi guida, di chi è, il numero e la partenza. Tocca un posto libero («Aggiungi») per metterci un'atleta, un posto occupato per toglierla o spostarla su un altro mezzo; oppure trascina le atlete da un mezzo all'altro (o da «Senza passaggio» su un mezzo, e viceversa). Quello che cambi si vede subito.",
      "Chi va con chi: sotto «Senza passaggio» scegli il mezzo per ogni convocata e tocca «Metti» (i mezzi pieni non si offrono), oppure trascinala sul mezzo. Eliminando un mezzo le atlete che c'erano sopra restano senza passaggio. Se una convocata viene tolta dalla partita dopo, resta sul mezzo con l'avviso «Non più convocata».",
      "Numeri di telefono e rubrica dei genitori: da «Rubrica genitori» scrivi una volta sola, per ogni atleta, fino a quattro numeri (nome, chi è e numero). Compaiono accanto all'atleta in ogni trasferta, con il link che dal telefono fa partire la chiamata. Se scrivi chi guida senza il numero e quel nome è in rubrica, il numero lo mette il sito; il nome si suggerisce mentre scrivi.",
      "Riepilogo PDF: «Riepilogo PDF» lo scarica e «Condividi PDF» apre il foglio di condivisione del telefono (WhatsApp, e-mail…). Dentro ci sono la partita e il ritrovo, i mezzi con chi guida e chi viaggia con chi, e chi è ancora senza passaggio. Non ci sono mai i numeri dei genitori né le note riservate; i numeri degli autisti solo se spunti «Con i numeri di telefono degli autisti».",
      "Sono dati personali, di minorenni: non compaiono mai sul sito pubblico né nelle notifiche, e il PDF si scarica solo con il permesso. In modalità prova lavori su una copia, che sparisce all'uscita.",
    ],
  },
  {
    page: "staff",
    icon: Users,
    title: "Staff",
    intro: "Gestione degli account che accedono all'area tecnici.",
    points: [
      "Solo i Developer creano nuovi account Admin, con una password temporanea da cambiare al primo accesso.",
      "Un Developer può anche modificare il nome utente di un Admin o impostargli una nuova password temporanea.",
      "Solo un Developer può rimuovere l'accesso a un account Admin.",
    ],
  },
  {
    icon: Globe,
    title: "Sito pubblico e notifiche",
    intro: "Il calendario è visibile a chiunque, senza bisogno di un account.",
    points: [
      "Il pulsante \"Sito pubblico\" nell'header porta alla homepage pubblica; da lì \"Area tecnici\" torna al login.",
      "Ogni PDF del sito si può scaricare o condividere come file: \"Scarica\" (o \"Esporta PDF\") lo salva sul dispositivo, \"Condividi PDF\" apre il foglio di condivisione del telefono o del tablet con il PDF già allegato (WhatsApp, e-mail, \"Salva su File\"); dal computer scarica lo stesso file. I PDF sono sette: il calendario delle partite (home pubblica ed elenco Partite), le formazioni di gara (finestra Convocazioni e formazioni), il riepilogo presenze, il riepilogo test fisici, il tabellino dello Scout (nell'elenco e nel tabellino) e il manuale d'uso dello Scout. Nei nomi dei file delle partite c'è la categoria (u14 o u15). Su iPhone e iPad i PDF non si aprono mai come pagina (con il sito sulla schermata Home non si tornerebbe più indietro): \"PDF\" e \"Scarica PDF\" aprono il file in un foglio dentro il sito, con \"Condividi / Salva su File\" (WhatsApp, \"Salva su File\", e-mail…) e \"Chiudi\" o \"Torna al sito\" per tornare dov'eri; \"Condividi PDF\" apre direttamente il foglio di condivisione del telefono.",
      "Il tema (Chiaro, Scuro o Automatico, che segue il dispositivo) si sceglie dal pulsante con sole o luna in alto nel sito pubblico e nella pagina di accesso, e dal menu del tuo account nell'area tecnici. La scelta resta su quel dispositivo: il sito parte sempre chiaro.",
      "Chiunque visiti il sito (pubblico o area tecnici) può installare l'app sul proprio dispositivo e attivare le notifiche: viene chiesto una sola volta, la prima volta che si naviga il sito.",
      "Chi ha attivato le notifiche riceve un avviso ogni volta che un allenamento o una partita viene aggiunto, modificato o rimosso dal calendario.",
      "Le notifiche di U14/U15 e quelle di Minivolley sono due cose distinte: si attivano dal sito (o dall'app) di ognuna e arrivano solo a chi le ha attivate per quella squadra. Sullo stesso telefono si possono avere tutte e due: se hai già dato il permesso da una squadra, aprendo il sito dell'altra compare di nuovo \"Attiva le notifiche\" per attivare anche quelle. Il selettore squadra dell'area tecnici non cambia niente: sceglie solo cosa vedi. Toccando una notifica si apre la squadra a cui appartiene.",
      "Se su un dispositivo arrivano avvisi che non vuoi, o doppi (per esempio la stessa notifica una volta dall'app di Under 14 e una da quella di Minivolley), usa \"Notifiche di questo dispositivo\", il collegamento in fondo al sito pubblico. Aprila dall'app o dal browser che ti dà il problema: su iPhone e iPad ogni app installata ha le sue iscrizioni, quindi va controllata una per una. Per ogni squadra vedi se su quel dispositivo le notifiche sono attive e le attivi o disattivi (\"Attiva\" / \"Disattiva\"). Se in un'app compare la nota che sono attive anche le notifiche dell'altra squadra, è il motivo degli avvisi doppi: tocca \"Disattiva\". Se compare l'avviso che un'iscrizione è registrata con la squadra sbagliata, tocca \"Rimetti a posto\". \"Togli tutte le notifiche da qui\" cancella tutte le iscrizioni di quel dispositivo (o di quell'app): poi attiva solo le squadre che ti servono. Il Developer vede tutte le iscrizioni, una per una, nel Centro di controllo.",
      "Le notifiche partono con priorità alta e restano sullo schermo finché non vengono aperte o chiuse. Il sito rinnova da solo l'iscrizione di chi le ha attivate se il browser la cancella (succede con il risparmio energia).",
      "Se un telefono Android non riceve le notifiche: Impostazioni > App > Chrome (o l'app \"Volley Lignano\" se installata) > Batteria > \"Senza restrizioni\"; poi in Chrome > Impostazioni > Impostazioni sito > Notifiche controlla che il sito sia tra quelli consentiti, e che \"Non disturbare\" non sia attivo. Con l'app installata sulla schermata Home le notifiche arrivano in modo molto più affidabile che dal solo sito aperto in Chrome.",
      "Su iPhone le notifiche funzionano solo se il sito è aggiunto alla schermata Home (Condividi > Aggiungi alla schermata Home) e si apre da lì; da Safari semplice non arrivano.",
      "Il Developer può far riapparire a tutti il messaggio \"Attiva le notifiche\" dal Centro di controllo (\"Chiedi a tutti di attivare le notifiche\"): lo vede chi apre il sito e non le ha ancora attivate, anche se l'aveva chiuso da poco. Chi le ha già attivate o le ha bloccate dal browser non vede niente.",
    ],
  },
];

export default async function GuidaPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);

  let visibleSections = SECTIONS.filter(
    (section) => !section.page || isPageAvailableForTeam(section.page, team),
  );
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    const allowedPages = staff?.allowedPages ?? [];
    visibleSections = visibleSections.filter((section) => !section.page || allowedPages.includes(section.page));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Guida al sito"
        description="Come funzionano le sezioni dell'area tecnici. Questa pagina resta sempre consultabile dal menu."
        actions={
          <LinkButton href="/admin?tour=restart" variant="outline">
            <Compass className="h-4 w-4" />
            Rivedi il tour guidato
          </LinkButton>
        }
      />

      <div className="space-y-4">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader className="flex flex-row items-center gap-3.5">
                <span className="icon-chip shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    {section.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{section.intro}</p>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <ul className="space-y-2 text-sm leading-relaxed text-foreground/80 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/45 [&>li]:before:content-['']">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })}

        {session.role === "dev" && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3.5">
              <span className="icon-chip shrink-0">
                <Gauge className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Manutenzione
                </h2>
                <p className="text-sm text-muted-foreground">Solo Developer.</p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <p className="text-sm text-foreground/80">
                La pagina{" "}
                <Link href="/admin/manutenzione" className="font-semibold text-primary hover:underline">
                  Manutenzione
                </Link>{" "}
                mostra righe e spazio occupato per ogni tabella su Supabase, e spiega la cache
                della homepage pubblica introdotta per restare entro i limiti mensili del piano.
              </p>
            </CardBody>
          </Card>
        )}

        {session.role === "dev" && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3.5">
              <span className="icon-chip shrink-0">
                <FlaskConical className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Modalità prova
                </h2>
                <p className="text-sm text-muted-foreground">Solo Developer.</p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="space-y-2 text-sm leading-relaxed text-foreground/80 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/45 [&>li]:before:content-['']">
                <li>
                  La voce &quot;Modalità prova&quot; nel menu del tuo account (in alto a destra) apre una copia separata
                  dei dati (allenamenti, partite, formazioni, schede, presenze, atlete): puoi creare,
                  modificare o eliminare qualsiasi cosa per provare lo strumento senza rischi.
                </li>
                <li>
                  Mentre sei in modalità prova non viene inviata nessuna notifica push, e nessuno di
                  quei cambiamenti compare mai sul calendario pubblico.
                </li>
                <li>
                  Uscendo (dal banner in alto) tutte le modifiche fatte in prova spariscono e torni
                  ai dati reali esattamente come li avevi lasciati. Account staff e iscrizioni alle
                  notifiche non sono mai coinvolti dalla modalità prova.
                </li>
              </ul>
            </CardBody>
          </Card>
        )}

        {session.role === "dev" && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3.5">
              <span className="icon-chip shrink-0">
                <Trophy className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Classifiche e risultati ufficiali
                </h2>
                <p className="text-sm text-muted-foreground">Solo Developer.</p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="space-y-2 text-sm leading-relaxed text-foreground/80 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/45 [&>li]:before:content-['']">
                <li>
                  Dal{" "}
                  <Link href="/admin/centro-controllo" className="font-semibold text-primary hover:underline">
                    Centro di controllo
                  </Link>{" "}
                  imposti, per ogni categoria, l&apos;indirizzo del girone sul portale della federazione e il nome con
                  cui la nostra squadra compare in classifica. Lascia l&apos;indirizzo vuoto finché il girone non è
                  pubblicato: la categoria resta nascosta.
                </li>
                <li>
                  Il sito rilegge il portale in secondo piano quando i dati hanno più di 30 minuti (e una volta al
                  giorno in automatico). Se il portale non risponde o cambia pagina, restano gli ultimi dati validi con
                  la loro data e l&apos;errore compare in{" "}
                  <Link href="/admin/manutenzione" className="font-semibold text-primary hover:underline">
                    Manutenzione
                  </Link>
                  .
                </li>
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center gap-3.5">
            <span className="icon-chip shrink-0">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Il tuo account</h2>
              <p className="text-sm text-muted-foreground">Password e accesso.</p>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-sm text-foreground/80">
              Puoi cambiare la tua password in qualsiasi momento dalla pagina{" "}
              <Link href="/admin/cambia-password" className="font-semibold text-primary hover:underline">
                Cambia password
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
