# Volley Lignano

Sito per la gestione della squadra femminile Under 14 e Under 15 di Volley
Lignano: calendario pubblico di allenamenti e partite, area riservata per lo
staff (Developer e Admin).

## Funzionalità incluse

- **Calendario pubblico** (`/`) — vista mensile + agenda con allenamenti
  ricorrenti (congiunti U14/U15) e partite, filtrabile per categoria. Ogni
  partita porta l'etichetta piena «U14» (verde acqua) o «U15» (viola)
  (`CategoryTag`, `src/components/ui/CategoryTag.tsx`: calendario, elenchi
  dell'area tecnici, Scout, Pronostici, banner in diretta, PDF); il feed
  `.ics` (`/calendario.ics`, `?cat=U14|U15`) mette la categoria nel titolo e
  segue il filtro scelto sulla home.
- **Autenticazione staff** — login con nome utente e password (nessun
  account richiesto per i visitatori pubblici). Due ruoli:
  - `DEVELOPER` — ruolo più alto, account iniziale `Gaga`.
  - `ADMIN` — creato da un DEVELOPER o da un altro ADMIN nella sezione
    "Staff" dell'area riservata.
  - Al primo accesso con password temporanea, il cambio password è
    obbligatorio.
  - Un pulsante nell'header dell'area riservata ("Sito pubblico") permette
    di tornare in un click al calendario pubblico.
- **Gestione allenamenti** (`/admin/allenamenti`) — regole ricorrenti per
  giorno della settimana, orario, luogo e periodo di validità. Una singola
  data si può annullare oppure spostare (orario e/o luogo diversi solo quel
  giorno): toccando un allenamento nel calendario (o nella dashboard) si apre
  "Modifica solo questo allenamento"; le
  altre date della serie restano come sono, il sito pubblico mostra
  l'avviso "Orario o luogo cambiati" e si può mandare una notifica. Le
  variazioni stanno in `training_sessions.occurrence_overrides` (vedi
  `supabase/schema.sql`).
- **Gestione partite** (`/admin/partite`) — partite per categoria (U14/U15),
  avversario, casa/trasferta, data/ora, luogo. La scheda di una partita
  (`/admin/partite/[id]`) va nell'ordine in cui serve: i dettagli in breve
  (`MatchDetailsCard`) con «Modifica», il riquadro «Risultato» a partita giocata
  (`MatchResultCard`, salvato da solo con `saveMatchResultAction`), le assenze e
  «Convocazioni e formazioni». Il modulo dei dettagli sta a parte, in
  `/admin/partite/[id]/modifica`, con l'eliminazione in fondo; salvando si torna
  alla scheda (una partita nuova torna all'elenco). Le **notifiche push** delle
  partite sono mirate (`src/lib/matchNotices.ts`, funzioni pure con i loro test
  in `unit/match-notices.spec.ts`): dicono che cosa è cambiato («Cambio orario»
  con l'orario di prima, «Cambio luogo», «Ritrovo aggiornato», «Nota sulla
  partita», «Cambiano data e luogo»…), il risultato («Vinta 3-1» e i parziali)
  e le convocazioni (quante e il ritrovo, mai i nomi, solo se cambia la lista);
  non partono se non cambia niente che interessi alle famiglie. Portano al
  calendario sul mese e sulla categoria della partita (`matchNoticeUrl`) e hanno
  il tag `partita-<id>`, così sul telefono l'ultimo avviso sostituisce il
  precedente. Il modulo mostra in anteprima la notifica che partirà.
- **Gestione staff** (`/admin/staff`) — creazione nuovi account admin con
  password temporanea. Un Developer può anche modificare il nome utente di
  un Admin o impostargli una nuova password temporanea.
- **Schede allenamento** (`/admin/schede`) — visibili solo a Developer e
  Admin. Incolla il testo di un allenamento com'è: l'IA (Gemini, chiave
  `GEMINI_API_KEY`) decide da sola dove inizia ogni blocco, qualunque sia la
  formattazione ("1. TITOLO – 10'", "A – 45' TITOLO", sezioni con esercizi
  numerati dentro…), e ne indica titolo e durata. Il contenuto di ogni
  blocco viene sempre ritagliato dal testo originale, mai riscritto dal
  modello, e vive solo dentro quella scheda (niente libreria condivisa).
  Se l'IA non è configurata o non risponde (si provano più modelli) si usano
  regole fisse. Le schede già salvate si possono ricontrollare con l'IA
  ("Ricontrolla le schede con l'IA" in `/admin/schede`, o dalla singola
  scheda): si vede la divisione proposta e si applica con un clic (il
  salvataggio è confermato rileggendo la scheda dal database). L'IA gratuita
  ha un limite di richieste per modello (oggi 20 al giorno): le schede che
  non è riuscita a controllare vengono elencate con il motivo e si possono
  riprovare da sole; un modello a cui è finito il limite viene saltato finché
  non si rinnova. Nei test l'IA è un finto Gemini (`e2e/fixtures/fake-gemini.mjs`,
  avviato da `playwright.config.ts`).
- **Presenze** (`/admin/presenze`) — registro presenze legato agli
  allenamenti del calendario: si sceglie l'allenamento da registrare e per
  ogni atleta si segna Presente/Assente (di default tutte presenti), con
  Assenza giustificata/non giustificata come dettaglio dell'assenza.
  Anagrafica atlete gestibile in `/admin/presenze/atlete` (una alla volta o
  incollando un elenco di più nominativi insieme in
  `/admin/presenze/atlete/elenco`; la categoria U14/U15 è facoltativa e
  assegnabile anche in un secondo momento), storico dei registri salvati
  (anche per singola atleta) in `/admin/presenze/storico`.
- **Test fisici** (`/admin/test-fisici`) — Squat Jump (3 salti), misure
  corporee e altri dati liberi per atleta, con lo storico di ognuna. Il
  «Riepilogo» (`/admin/test-fisici/riepilogo`) mette tutte le atlete in una
  tabella: ultimi risultati, un giorno di test o tutte le sessioni; ricerca,
  filtro per categoria, ordinamento con un clic sulle intestazioni, variazione
  rispetto alla misura precedente, valore più alto di ogni salto in evidenza,
  media di quello che si vede, «Scarica CSV» e «Scarica PDF» (stessa tabella,
  con gli stessi filtri e ordine, che arrivano come parametri dell'indirizzo).
  La logica che trasforma le righe `PhysicalTest` in tabella è in
  `src/lib/physicalTestOverview.ts` e `src/lib/physicalTestTable.ts` (con test
  unitari); la media dei salti ignora i valori mancanti (non contano come
  zero).
- **PDF da stampare** (`src/lib/pdf/`) — base comune (`report.ts`: intestazione
  con stemma, tabelle che continuano sulle pagine seguenti, numero di pagina;
  stessi font del PDF delle formazioni) e tre documenti: il calendario di
  tutte le partite (pubblico: `/calendario-partite.pdf`, `?cat=U14|U15`, letto
  dalla cache del sito; staff: `/api/partite/pdf`, in più «da inserire» dove manca il risultato),
  il riepilogo presenze (`/api/presenze/riepilogo/pdf`) e il riepilogo test
  fisici (`/api/test-fisici/riepilogo/pdf`). Elenco atlete e storico presenze
  restano solo in CSV (sono dati da elaborare, non da stampare). Ogni PDF del
  sito (anche il tabellino e il manuale dello Scout, le formazioni di gara e le convocazioni) ha
  «Scarica» e «Condividi PDF» (`src/components/pdf/SharePdfButton.tsx`): dal
  telefono apre il foglio di condivisione con il file già allegato, altrove
  scarica; il file si prepara in anticipo (`prefetch`) o al primo tocco.
  Il calendario partite ha nel PDF una colonna con «U14»/«U15» su riquadro
  pieno e una barra del colore della categoria sulla riga; i nomi dei file di
  tabellino, formazioni e convocazioni portano la categoria. Le **convocazioni**
  (`/api/partite/[id]/convocazioni/pdf`, `src/lib/pdf/convocationPdf.ts`) sono
  un foglio da mandare a famiglie e atlete: la partita, il ritrovo e le
  convocate con il numero di maglia, mai formazioni, note né assenze;
  serve il permesso «Partite», e con `?ids=` segue la
  selezione della finestra delle convocazioni anche se non è ancora salvata.
- **Pronostici** (`src/lib/predictions.ts`) — si aprono il giorno della
  partita e si chiudono **10 minuti dopo l'inizio** (`PREDICTION_GRACE_MINUTES`),
  o subito se il risultato è già stato inserito; pagina e azione dicono
  l'orario di chiusura. Dopo la chiusura i pronostici di tutti diventano
  visibili.
- **Trasferte** (`/admin/trasferte`, solo U14/U15, sezione «super riservata») —
  per ogni partita fuori casa i **mezzi** (auto, pulmino, pullman…) con di chi
  è il mezzo, autista, numero di telefono, posti per le atlete e partenza, e
  **chi va con chi**: le convocate della partita si mettono sui mezzi (i pieni
  non si offrono, ognuna è su un mezzo solo, `src/lib/trips/rules.ts` in
  funzioni pure con le loro prove). La scheda è una lavagna interattiva
  (`TripBoard`): ogni mezzo si vede dall'alto con un riquadro per posto
  (`SeatMap`, disposizione per tipo in `seatLayout`), si cambiano da lì i posti
  (+ e −), chi guida, di chi è, il numero e la partenza; un posto libero si
  tocca per metterci un'atleta, uno occupato per toglierla o spostarla, e le
  atlete si trascinano da un mezzo all'altro. Ogni cambiamento si vede subito
  (`useOptimistic`, con le stesse regole del server) e intanto va al server;
  se il server lo rifiuta torna com'era e lo dice. I mezzi usati in altre
  trasferte si rimettono con un tocco (`suggestVehicles`). La **rubrica dei
  genitori** (`/admin/trasferte/rubrica`) tiene fino a quattro numeri per
  atleta, scritti una volta e ripresi in ogni trasferta con il link `tel:`;
  chi guida senza numero scritto lo prende dalla rubrica se il nome c'è una
  volta sola. Il **riepilogo PDF**
  (`/api/trasferte/[matchId]/pdf`, `src/lib/pdf/tripPdf.ts`, «Scarica» e
  «Condividi PDF») dice partita, ritrovo, mezzi e chi viaggia con chi, e chi è
  ancora senza passaggio: mai i numeri dei genitori né le note riservate, i
  numeri degli autisti solo con `?numeri=autisti`. Dati personali di
  minorenni, quindi: serve il permesso pagina `trasferte`, che **nessun
  account ha di partenza** (non è tra `DEFAULT_NEW_ADMIN_PAGES`, e gli Admin già
  esistenti non lo hanno): il Developer lo spunta account per account dal
  Centro di controllo. Lo controllano il layout della sezione, ogni azione
  (`requireStaffPage("trasferte")`) e il PDF (`requireTripAccess`, con 401/403 e
  `Cache-Control: no-store`); non c'è niente sul sito pubblico né nelle
  notifiche, e per il Minivolley la pagina non esiste
  (`PAGES_UNAVAILABLE_FOR_MINIVOLLEY`). I dati stanno in due tabelle da creare
  su Supabase una volta sola (blocchi `match_trips` e `athlete_contacts` di
  `supabase/schema.sql`; finché mancano le pagine lo spiegano, come per lo
  Scout): un documento JSON per partita con una `version` (ogni azione rilegge e
  rifà la stessa modifica se nel frattempo un altro ha salvato) e una riga per
  atleta con i suoi contatti. Segue la modalità prova come le altre sezioni.
- **Assenze alle partite e link per i genitori** (`/disponibilita/[codice]`, pagina pubblica; gestione nella
  sezione «Assenze», `/admin/assenze`, solo U14/U15) — ai genitori si chiede **solo
  se la figlia non ci sarà**: chi non segnala niente ci sarà. I genitori non hanno un
  account: ogni atleta ha un **link personale e segreto** (32 caratteri casuali, 192
  bit, `src/lib/availability/token.ts`) che lo staff manda su WhatsApp (o copia). Da lì
  il genitore vede solo la sua atleta e le prossime partite della sua categoria e, per
  ognuna, tocca «Non ci sarà» (si salva subito, senza conferme: `useOptimistic`); poi,
  se vuole, un motivo a scelta e una nota breve, oppure «Annulla». Può farlo **fino alla
  scadenza della partita**: di serie 5 giorni prima dell'inizio, alla stessa ora
  (`REPORT_CLOSES_DAYS_BEFORE`, `autoDeadline` in `src/lib/availability/reporting.ts`:
  giorni del calendario, quindi l'ora legale non sposta niente; partita sabato alle 18 →
  fino a lunedì alle 18, e la pagina lo scrive); dopo, la partita resta visibile ma
  chiusa e per avvisare si scrive all'allenatore. Regole e scadenze le decide lo staff
  (vedi «Sezione Assenze» qui sotto). Lo staff, nella pagina di ogni partita della
  sezione (`/admin/assenze/partita/[id]`, `AvailabilityBoard`), vede chi non ci sarà con motivo, nota e
  chi l'ha segnalata, e segna o toglie un'assenza con un tocco **sempre**, anche a
  partita finita; l'assenza compare come avviso nelle convocazioni (rosso se è
  convocata) e l'elenco partite e la dashboard dicono «N non ci sono». Il nome non è mai
  la chiave (i nomi sono già pubblici in convocate e presenze): conta solo il codice,
  ricontrollato da ogni azione (`reportAbsenceAction` e `clearAbsenceAction` per il
  genitore, con la scadenza; `setStaffAbsenceAction` per lo staff, che ricontrolla il
  permesso «Partite»); un codice sbagliato mostra sempre la stessa pagina, senza dire
  niente. La pagina non va sui motori di ricerca, non è mai in cache, non passa il suo
  indirizzo ad altri siti (`referrer: no-referrer`), ha titolo e descrizione uguali per
  tutti (l'anteprima di WhatsApp non mostra nomi) e non mostra gli avvisi di
  installazione e notifiche. Legge sempre il database reale (`getRepo()`), mai la
  modalità prova. Lo staff, da «Link per i genitori» della sezione (`/admin/assenze/link`): «Crea i link
  mancanti», «Copia link», «WhatsApp» (con il permesso Trasferte si apre già sul numero
  della rubrica, `whatsappPhone`) e «Rigenera» (il codice vecchio smette subito). Le
  assenze non tolgono nessuna dalle convocate da sole. Mai sul sito pubblico. Due tabelle
  da creare su Supabase una volta sola (blocchi `athlete_family_links` e
  `match_availability` di `supabase/schema.sql`, che porta con sé anche le righe della
  vecchia tabella `match_unavailability`, se c'era; finché mancano le pagine lo
  spiegano). Nella tabella si scrive solo lo stato «absent»: le righe «present» di una
  versione di prova non contano. In modalità prova si copiano le assenze ma non i link
  (sono segreti, e quelli creati in prova non funzionano per i genitori).
- **Sezione Assenze** (`/admin/assenze`, voce «Assenze» nel menu accanto a Partite, con lo
  stesso permesso «Partite», solo U14/U15) — tutto quello che riguarda le assenze sta qui,
  separato dalle altre sezioni, in tre parti (`AssenzeTabs`): «Partite», «Link per i
  genitori» (`/admin/assenze/link`) e «Regole» (`/admin/assenze/regole`); fuori restano solo
  l'avviso nelle convocazioni e il contatore «N non ci sono» (elenco partite e dashboard).
  I vecchi indirizzi (`/admin/partite/assenze`, `/admin/presenze/atlete/link-genitori`)
  portano qui (`redirects` in `next.config.ts`). Per ogni partita in programma: come stanno
  le segnalazioni dei genitori e chi non ci sarà, con i comandi (`ReportingControls`, gli
  stessi nella pagina della partita) «Chiudi adesso», «Riapri fino all'inizio», «Scadenza automatica», «Scegli la
  scadenza» (mai oltre l'inizio), un messaggio ai genitori sotto quella partita e «Chiedi
  ai genitori le assenze per questa partita» (tolta la spunta, dal link non si vede). Le
  **regole per tutte le partite**: giorni prima (0–14, 0 = all'inizio), all'ora della
  partita o a un'ora fissa, pausa per tutte e un avviso in cima alla pagina di ogni
  genitore. Poi «Ultime segnalazioni» e un **promemoria per il gruppo** (partite aperte
  e scadenze, mai nomi né link) da copiare o mandare su WhatsApp. Regole pure in
  `src/lib/availability/reporting.ts` (`reportingState`: prima «non chiesta», poi pausa,
  poi scadenza); azioni in `src/app/admin/assenze/reporting-actions.ts`, che
  ricontrollano permesso e dati e scrivono chi ha cambiato e quando; la pagina del
  genitore e le sue azioni seguono le stesse regole (anche da una pagina rimasta aperta).
  Nessuna tabella nuova: regole e scelte stanno in `app_settings` (`availability_rules`,
  `availability_match:<id>`, JSON), in modalità prova restano nella prova. Se nel
  database manca una tabella delle assenze, le pagine dello staff lo dicono e al
  Developer mostrano l'SQL già pronto da copiare (`src/lib/availability/setupSql.ts`,
  uguale a `supabase/schema.sql`: lo controlla una prova).
- **Certificati medici** (`/admin/certificati`, solo U14/U15, permesso a sé
  «Certificati medici») — per ogni atleta se il certificato medico è valido. Il
  documento non si carica mai: il genitore, dal suo link personale (lo stesso delle
  assenze, riquadro «Certificato medico» con `id="certificato"`), sceglie con il
  calendario del telefono (`type="date"`) il giorno della visita e fino a quando vale
  (la scadenza si propone un anno dopo). Lo stato si calcola da solo
  (`src/lib/medical/certificate.ts`, funzioni pure con le loro prove): «Valido»,
  «Scade tra N giorni» in rosso **da un mese prima** della scadenza (`warningFrom`:
  un mese di calendario, scadenza il 31 marzo → dal 28 febbraio; ancora valido),
  «Scaduto» e «Da inserire» (senza date non risulta valido). La pagina dello staff
  mette in cima, in rosso, scaduti e in scadenza (`compareUrgency`), poi senza date e
  in regola; «Avvisa il genitore» apre WhatsApp con il messaggio pronto e il link
  (`parentReminder`; sul numero della rubrica con il permesso Trasferte); lo staff
  può scrivere, correggere o togliere le date, e si vede chi le ha scritte («dal
  genitore», «da Gaga»). La dashboard avvisa quando ce n'è almeno uno da rinnovare.
  Le date si controllano da entrambe le parti (`certificateFromInput`: giorni veri,
  visita non nel futuro, scadenza dopo la visita e al massimo due anni dopo). Il
  permesso non ce l'ha nessuno di partenza (escluso da `DEFAULT_NEW_ADMIN_PAGES`, come
  Trasferte): il Developer lo dà dal Centro di controllo. Nessuna tabella nuova: una
  chiave `medical_certificate:<id atleta>` in `app_settings`; in modalità prova resta
  nella prova, e la pagina del genitore usa sempre il database reale.
- **Live score** (`/admin/livescore`, regole in `src/lib/liveScore.ts`) —
  tabellone dal 2 contro 2 al 6 contro 6, con o senza libero, oppure «solo
  punteggio» senza formazione (e senza seguire chi batte); rotazione e libero
  calcolate per qualunque numero di giocatrici. Disposizioni in
  `courtLayout`: 2 affiancate, 3 a triangolo, 4 a rombo, 5 e 6 su due file.
  Le regole della pallavolo stanno in funzioni pure, comuni a Live score e
  Scout, e hanno i loro test (`unit/livescore.spec.ts`):
  - `src/lib/volleyRules.ts`: **regole della stagione 2026/2027**
    (`RULES_SEASON`: dal 28 settembre 2026 la FIPAV applica in tutte le gare i
    «FIVB Rule Tests 2026»; qui stanno `SUBSTITUTIONS_PER_SET` = **8** cambi a
    set, prima 6, `TIMEOUTS_PER_SET` = 2 e `TIMEOUT_SECONDS` = 30, una sola
    fonte per Live score, Scout, guida e manuale), formati (**3 set su 5**,
    **2 set su 3**, **3 set
    fissi**; in Allenamento anche **Libera**, senza limiti di punti: chiude i
    set chi segna), 25 punti con 2 di scarto (15 nel set decisivo; si cambiano
    da «Punti» in impostazione, anche per i 3 set fissi, dove l'ultimo va a
    15 o a 25 secondo la gara), cambio campo **ogni 2 set** (dopo il 2°, dal
    2026/2027: `sidesChangeAfterSet`; il decisivo ha il sorteggio) e a 8 punti
    nel decisivo.
  - `src/lib/lineup.ts`: rotazione (solo quando si conquista la battuta),
    **libero** (ricavata da dove stanno le giocatrici: sostituisce la
    centrale in seconda linea, non batte mai, quindi in posizione 1 entra
    solo quando la squadra riceve, ed esce quando la centrale ruota a rete) e
    **cambi** (`substitutionRuleWarning`: 8 per set, titolare che rientra una
    volta sola e solo al posto di chi l'ha sostituita, dovunque questa stia
    adesso; riserva che esce solo per la titolare; sono avvertimenti, non
    divieti: un infortunio fa eccezione) e il controllo della formazione scritta
    a mano (`lineupIssues`: numero scritto in due posizioni, libero con il
    numero di una giocatrice in campo, centrali uguali: la partita non parte
    finché non si correggono, e la libero non compare mai in due posti).
  Il tabellone **guida la gara** (`LiveScoreStatus.tsx`): chiede il
  sorteggio per chi batte per primo, a set vinto propone la chiusura
  (`suggestedSetEnd`, pulsante «Chiudi il set»), poi mostra la scheda del
  nuovo set (con il **cambio campo** ogni 2 set), chi batte per primo (si
  alterna a ogni set; nel set decisivo si rifà il sorteggio) e la **formazione di partenza
  rimessa com'era** (`startPositions`); avvisa del set point, del match
  point e del cambio campo a 8 nel set decisivo. Con le frecce ← e → della
  tastiera si segna il punto della squadra a sinistra o a destra, con ⌫ si
  annulla; il formato scelto si ricorda sul dispositivo. I comandi sono pensati
  per il bordo campo: pulsanti dei punti grandi e «a tasto» (con il «+1» e il
  tasto della tastiera), ogni azione col suo colore (`ACTION` in
  `LiveScoreClient.tsx`, lo stesso ovunque compaia): «Annulla» scuro, «Cambio»
  azzurro, «Chiudi set» verde, «Inverti» viola, «Formazioni» verde acqua,
  «Diretta» rosa, «Nuovo» rosso perché cancella la partita; time-out gialli e
  cambi azzurri di ogni squadra con l'etichetta e il conto («Time-out 0/2»,
  «Cambi 0/8»); da telefono la barra delle azioni è
  fatta di tasselli con l'icona sopra l'etichetta. Su schermo largo (da 1024 px,
  `useMediaQuery`) la partita ha tre colonne: tabellone in alto (cifre che
  seguono l'altezza del display, con le unità `cqh`), poi i comandi di una
  squadra (pulsante dei punti, «Time-out», «Cambi»: `teamColumn`), il campo più
  piccolo con le azioni della partita sotto, e i comandi dell'altra squadra; anche
  l'impostazione è su due colonne, con «Inizia» sempre in vista. **Time-out**:
  ogni squadra ne ha 2 a set, da 30 secondi (`TIMEOUT_SECONDS`); «Time-out» lo
  segna e fa partire il **conto alla rovescia** (`TimeoutCard.tsx`, i conti in
  `src/lib/timeoutClock.ts` con test in `unit/timeout-clock.spec.ts`): scheda
  grande sotto il tabellone, arancione negli ultimi 10 secondi, a zero due bip
  (Web Audio, `src/lib/beep.ts`; si spegne con l'altoparlante, scelta ricordata
  sul dispositivo) e vibrazione dove c'è; si chiude da sola dopo qualche secondo,
  con «Fine time-out» o se si segna un punto; il terzo tocco su «Time-out» azzera
  il conteggio senza far partire niente. Il tempo si legge da `Date.now()`, quindi
  resta giusto anche con la pagina in secondo piano. Sostituzioni durante
  il gioco (`substitutePlayer`): contate per set, elencate in
  `substitutions`, annullabili come un punto, mai esposte alla diretta
  pubblica. Lo stato si salva in automatico per 3 ore (riga unica
  `live_score_state`, campo `data` jsonb: i campi nuovi hanno un valore di
  partenza in `src/lib/liveScoreSchema.ts`, nessuna migrazione). In Partita un
  admin può accendere la **diretta pubblica**: `/api/livescore/pubblico`
  espone solo squadre, punti, set, chi serve e time-out usati nel set (mai
  nomi o formazioni), con cache di 3 secondi solo sulla CDN di Vercel
  (`Vercel-CDN-Cache-Control`, mai nel browser); il riquadro «In diretta»
  (`LiveScoreBanner`) sulla home U14/U15 o Minivolley lo rilegge ogni 5
  secondi mentre la pagina è visibile. Segue il tema scelto (chiaro o scuro,
  e i colori del sito): è una scheda come le altre, con i colori delle due
  squadre come filo in alto, bagliore dalla loro parte (`--live-glow` in
  `globals.css`, più acceso sullo scuro) e segno sotto il punteggio. Ha lo
  stemma (o le iniziali nel colore scelto per l'avversaria), il punteggio
  grande, i set vinti, due pallini dei time-out per squadra e i parziali dei
  set chiusi.
- **Scout** (`/admin/scout`, permesso «Scout», regole in `src/lib/scout/`) —
  si segna la partita scambio per scambio, al **livello** scelto prima di ogni
  partita (`settings.level`, `levels.ts`): **Base** (chi fa punto e come, come
  negli scout dei campionati ufficiali con Data Volley) o **Con ricezioni** (in
  più la nostra ricezione, con voto e zona). Il vecchio livello **Completo**
  (ogni tocco) è stato tolto: gli scout salvati così si leggono come «Con
  ricezioni» senza perdere punti (`readLevel` in `levels.ts`, anche nello
  schema). A livello Base: attacco, muro, ace, oppure l'errore o il
  fallo dell'altra squadra (`rules.ts`: battuta, ricezione, attacco, muro,
  alzata, difesa, rete, invasione, doppia, trattenuta, quattro tocchi,
  rotazione, sanzione), con la giocatrice se si sa. Si salvano **solo gli
  scambi** (`events`, riga per partita in `match_scouts`, campo `data` jsonb):
  punteggi, set vinti, chi batte, break point e cambio palla si ricavano ogni
  volta (`derive.ts`), quindi correggere o annullare uno scambio non può
  mandare niente fuori sincrono. Le regole dei set sono quelle FIPAV (25 con 2
  di scarto, ultimo set a 15; 3 set su 5, 2 su 3 o 3 fissi). Il **tabellino**
  (pagina `/admin/scout/[matchId]/tabellino`, `TabellinoSheet.tsx`) è fatto
  come quelli delle leghe (gli scout ufficiali): campionato e stagione, le due
  squadre con i set vinti, dati della partita, set con durata stimata,
  **parziali** (il punteggio quando una delle due arriva a 8, 16 e 21; a 8 nel
  set corto) e finali; una tabella per squadra con tutta la rosa: **Set** (la
  posizione di partenza in ogni set, un rettangolo per chi è entrata o la
  libero, i set cerchiati dove la squadra ha battuto per prima), Punti Tot/BP/V-P,
  Battuta Tot/Err/Pt, Ricezione Tot/Err/Pos%/(Prf%), Attacco Err/Mur/Pt,
  Muro Pt, i totali e i **punti vinti set per set** (Bat, Att, Mu, Er.Av);
  sotto, per ogni squadra i punti fatti meno persi in ogni rotazione,
  ricezioni e punti in cambio palla (CP), battute e break point (BP), e in
  mezzo (a Con ricezioni) il cambio palla dopo ricezione positiva o
  negativa. Lo zero è « . » come nei
  tabellini ufficiali, «–» vuol dire che a quel livello non si segna. Tutto si
  ricava dagli scambi già segnati (`buildSheet` in `sheet.ts`, colonne e
  formati in `sheetFormat.ts`, usati insieme da pagina e PDF), quindi vale
  anche per le partite scoutizzate prima; le battute di ogni giocatrice si
  contano quando si sa chi batteva (`serverOf`: la battuta segnata, chi ha fatto
  l'ace o sbagliato la battuta, oppure la posizione 1 con la formazione). Sotto
  il tabellino ci sono le **analisi** (tutta la partita o un set: break point,
  cambio palla, «come si è fatto punto», errori e falli, andamento del
  punteggio e, con le ricezioni, la ricezione e la sua mappa). Il PDF
  (`src/lib/pdf/scoutPdf.ts`) è solo il tabellino in A4 verticale, sempre su
  tutta la partita (`scoutSheetPdf.ts`, disegnato con `PdfReport.drawnPage` in
  un documento `drawnOnly`; con rose lunghissime continua su una seconda
  pagina): le analisi restano nella pagina. Il
  riepilogo di stagione resta con le colonne di `columns.ts`. Il salvataggio
  (`useScoutSession`) è automatico e non deve mai far perdere punti: lo stato è
  in un solo posto (`createSessionStore`) letto da pagina e salvataggi; ogni
  richiesta ha un limite di tempo (`SAVE_TIMEOUT_MS`, poi si interrompe e si
  rifà) e dopo un rifiuto non ci si ferma; le modifiche non salvate stanno in
  una copia nel telefono (solo finché non sono sul server). Ogni salvataggio
  dichiara la versione (`version`) su cui si basa: se il server ne ha un'altra
  (409 dalla API `/api/scout/[matchId]`) `reconcile` (`sync.ts`) guarda gli
  scambi: se uno dei due ne ha solo di più (di solito la risposta si era
  persa) o se sono di momenti diversi, le versioni si uniscono da sole (rosa
  sempre unita, mai scambi doppi); si chiede (`ConflictDialog`) solo se due
  persone hanno segnato cose diverse negli stessi momenti. Anche all'apertura
  (`planStart`). Le versioni sostituite o scartate e una copia per ogni set
  chiuso restano nel dispositivo (`archive.ts`, «Squadre e regole», poi «Copia
  di sicurezza», `ScoutSafety.tsx`) e si ripristinano; lo scout si scarica e si
  rimette come file (`backupFile.ts`). Se il salvataggio non va (senza rete,
  server che non risponde da più di 20 secondi, sessione scaduta, dati
  rifiutati: il motivo è nei log del server e nel messaggio) compare un avviso
  con gli scambi non ancora salvati. Test: `unit/scout-sync.spec.ts`,
  `unit/scout-archive.spec.ts`, `e2e/scout-salvataggio.spec.ts` (risposta
  persa, richiesta appesa, conflitto, copie). Solo partite di
  U14/U15, non tornei né Minivolley. Un account nuovo ha già il permesso
  «Scout»; per gli Admin esistenti va spuntato dal Centro di controllo.
  - **Livelli**: `level` sta nel `settings` jsonb dello scout, quindi non serve
    nessuna migrazione e gli scout salvati prima valgono «base»
    (`levelOf`, `normalizeSettings`). Con ricezioni, oltre agli scambi si
    salvano i **tocchi** (la ricezione; gli scout del vecchio Completo ne hanno
    di ogni fondamentale, e si leggono ancora) (`ScoutTouchEvent`, voti `# + ! - / =`,
    zona 1-6 facoltativa, regole in `touches.ts`): un voto che chiude lo
    scambio (errore, ace, attacco a terra, muro vincente) assegna il punto da
    solo, gli altri lasciano lo scambio aperto (`pending`) finché un altro
    tocco o un esito scelto a mano lo chiude. `derive.ts` ricostruisce tutto
    dagli eventi; `effectiveTouches` rende uguali i conti di chi segna a
    punto e di chi segna i tocchi. `stats.ts` ricava ricezione, zone e
    rotazioni (si parte dalla 1ª a ogni set e si avanza a ogni cambio palla:
    senza formazioni sono indicative). Le
    colonne del tabellino sono in `sheetFormat.ts` (pagina e PDF) e la legenda
    per livello del manuale in `legend.ts`. Inserimento: scheda della
    ricezione (`ScoutReception.tsx`: quando battono loro si apre da sola una
    finestra, la stessa dei tasti dei punti (`ScoutSheet.tsx`), con il campo a
    sinistra dove si tocca chi ha ricevuto, i voti grandi a destra, la zona
    (facoltativa), la panchina e «Non so»; senza formazione una riga di numeri;
    si chiude con «Salta la ricezione» o Esc, toccare fuori non la chiude, e in
    pagina resta una riga con «Segna la ricezione» per riaprirla; a set finito
    non si apre); correzione dei tocchi dal Registro.
  - **Formazione in campo** (facoltativa, come nel Live score): si scrive
    nella preparazione (`ScoutLineupEditor.tsx`, subito sotto le giocatrici) o
    nella finestra «Formazione» (`ScoutLineupSheet`: dal pulsante «Formazione»,
    da «Segui la formazione» o da sola a ogni set nuovo, quando `setLineupPending`
    in `court.ts` dice che nessuno l'ha ancora scritta per quel set). Parte da
    quella preparata in Partita per quel set, altrimenti da quella del set
    prima: «Comincia» (`commitRef`) applica da sola quella scritta e non
    ancora confermata, quindi non va riscritta due volte. Chi gioca nelle sei
    posizioni, la libero e le due centrali che sostituisce. Ogni
    squadra ha la sua metà campo, con la rete in alto (davanti 4-3-2, dietro 5-6-1) come nel «chi?»
    (`LineupHalf`), e le due metà stanno una sopra l'altra con sei caselle larghe uguali: nel campo
    intero in orizzontale la fila a rete era larga un terzo e i nomi non si leggevano, nemmeno su
    iPad. Dal telefono l'intestazione dello Scout sta in una
    riga («Live» e, quando va tutto bene, solo l'icona del salvataggio), «Comincia a segnare i punti»
    riporta in cima al tabellone e niente scorre di lato (`e2e/scout-telefono.spec.ts`). Due eventi in più nello scout,
    `lineup` e `sub` (`types.ts`, `schema.ts`, `actions.ts`): `derive.ts` li
    legge con lo stesso motore di `src/lib/lineup.ts` (stessa rotazione, stessa
    libero, stessi avvertimenti sui cambi) e ricava `ScoutView.court`, la
    formazione di ogni squadra a ogni scambio. Ogni set riparte dalla
    formazione con cui era cominciato. Si può seguire solo la nostra squadra,
    tutte e due o nessuna: senza formazione lo Scout funziona come prima.
    Aiuti in `src/lib/scout/court.ts` (chi batte, panchina, ordine «prima chi è
    in campo», il campo da disegnare `courtSpots`, avvertimento sul cambio,
    formazioni di partenza e cambi per il tabellino). Schermate: striscia «In
    campo» (`ScoutCourtStrip.tsx`, con i cambi); scelta di chi ha fatto l'azione
    dal campo (`ScoutCourtPicker.tsx`: rete, 4-3-2 davanti e 5-6-1 dietro, libero
    in scuro, pallone verde su chi batte, panchina sotto; a muro la libero non si
    sceglie e la seconda linea è più chiara; senza formazione resta l'elenco di
    numeri, con un avviso per impostarla). Il «chi?» non si chiede mai per
    l'attacco vincente loro («Punto loro > Attacco» si segna con un tocco solo,
    regola `asksPlayerFor` in `rules.ts`; nel Registro si legge «Squadra»). Con la formazione
    non si chiede nemmeno per ace e battuta sbagliata della squadra che batte:
    vanno da soli a chi è in posizione 1 (`autoServePlayer` in `court.ts`, usato da
    `ScoutEntry.tsx`); se non era lei,
    accanto all'ultimo punto c'è «Cambia» (`servePlayerWasAuto`), che apre il campo
    com'era in quello scambio e corregge solo la giocatrice (`updateRally`, il
    punteggio non cambia). Se si tocca «Ace» per la squadra che non batte, «chi?»
    si chiede come sempre. Il cambio disegna lo stesso campo con
    numero e nome di ognuna e ha «Cambia la libero» (non conta tra i cambi: è un
    evento `lineup` con la libero nuova); formazioni di partenza e cambi nel tabellino
    (`src/components/scout/ScoutLineups.tsx`) e nel PDF
    (`lineupSections` in `scoutPdf.ts`). Nessuna migrazione: sono eventi nel
    `data` jsonb, e gli scout vecchi si leggono come prima.
    **Correzione della rotazione**: se una rotazione è saltata, «Rotazione» sotto la
    squadra (`RotationSheet` in `ScoutCourtStrip.tsx`) la gira avanti o indietro di 1…5
    posizioni con l'anteprima del campo. È un evento `rotate` (`ScoutRotateEvent`,
    `steps` da −5 a 5): `derive.ts` ruota la formazione con `shiftCourt` (la stessa
    funzione dell'anteprima) e riallinea la libero, ma non tocca punteggio, chi batte,
    cambi né time-out; correzioni ravvicinate della stessa squadra si sommano
    (`rotateTeam` in `actions.ts`, a somma zero spariscono). A set non cominciato
    corregge la formazione di partenza; a set cominciato compare nel registro del set
    (`ScoutSet.rotations`, con il cestino). Ogni `ScoutRally.rotation` dà la rotazione
    di ogni squadra a inizio scambio (anche senza formazione, dall'ordine di battuta più
    le correzioni): la tabella delle rotazioni di `stats.ts` la legge da lì.
  - **Time-out**: un evento `timeout` (`ScoutTimeoutEvent`, come `sub`: `types.ts`,
    `schema.ts`, `actions.ts` con `addTimeout`) che non tocca punteggio, battuta né
    tocchi in sospeso. `derive.ts` li conta per set e per squadra (`ScoutSet.timeouts`,
    con il punteggio del momento; al massimo `TIMEOUTS_PER_SET` per squadra: quelli in più
    nei dati si ignorano). Sotto il punteggio del tabellone (`ScoutBoard`) ogni squadra ha
    il suo pulsante «Time-out» con due pallini (`TimeoutButton`, `data-scout-timeout`);
    «Annulla ultimo» lo toglie se è l'ultima cosa segnata, il Registro lo mostra tra i
    cambi del set con il cestino (`ScoutLog.tsx`). Lo Scout non ha il conto alla
    rovescia dei 30 secondi (c'è nel Live score). I time-out usati vanno sul riquadro
    «In diretta» (`PublicLiveScore.timeouts`).
  - **Diretta video** (guida «Diretta video» in `/admin/guida`): ogni telefono su cavalletto fa
    una diretta su YouTube e i genitori guardano da `/diretta` (`src/app/diretta/`,
    `DirettaClient.tsx`): il video non passa mai da Vercel né da Supabase. La pagina è statica:
    legge le camere da `GET /api/diretta` (`src/app/api/diretta/route.ts`, in cache 10 s sulla
    rete di Vercel) e incorpora il lettore YouTube (`youtube-nocookie.com/embed/<id>?fs=0`, senza
    il pulsante schermo intero di YouTube, che lascerebbe fuori il punteggio) con sopra, in un
    secondo riquadro trasparente senza tocchi, la grafica `/diretta/grafica`. Pulsanti per
    scegliere la camera (fino a 3, la scelta resta nel telefono), schermo intero del riquadro
    intero (Fullscreen API; su iPhone il riquadro a tutta pagina) e controllo del ritardo del
    punteggio con − e +. Le camere le incolla lo staff nella scheda «Diretta video» in cima
    all'elenco Scout (`src/app/admin/scout/DirettaCard.tsx` + `diretta-actions.ts`, permesso
    «Scout», mai in modalità prova): `app_settings.live_stream`, JSON con camere, ritardo e ora
    del salvataggio (`src/lib/diretta/streams.ts`: legge i link `youtu.be/…`, `watch?v=…`,
    `live/…`, `embed/…`, accetta solo identificativi di 11 caratteri, scade dopo 12 ore).
    **La grafica** (`/diretta/grafica`, `GraficaClient.tsx`): pagina con lo sfondo trasparente,
    anche da mettere in Streamlabs Desktop o OBS come «Browser Source» 1920×1080 (la grafica
    entra nel video e ai genitori basta il link di YouTube: i passi sono nella Guida). Legge
    `/api/livescore/pubblico?prima=1` (stesso punteggio del banner) e disegna due barre: la piccola
    in un angolo (`src/components/diretta/Scorebug.tsx`: battuta, time-out, set vinti, punti,
    parziali, SET/MATCH POINT) e la larga in basso al centro come in TV (`ScorebugWide.tsx`:
    stemma e nome, «SETS», punti del set in un riquadro scuro, linguetta con il set), più le
    schede di time-out e finale sotto la piccola (`Cards.tsx`) e, a fine set e a fine partita, il
    resoconto con i numeri di squadra (`SetRecapPanel.tsx`). Il logo delle squadre è sempre
    `TeamMark.tsx` (stemma nostro; per l'avversaria `away.logo` o le iniziali). Le misure sono in
    `rem` con `html { font-size }` legato alla larghezza dello schermo, quindi scala con
    qualunque dimensione. Cosa è cambiato tra due letture è logica pura in
    `src/lib/diretta/overlayEvents.ts` (`diffLive`, `feedReducer`: la scheda di fine set porta il
    resoconto se `live.recap` è quello del set appena chiuso, e dura 14 s invece di 9). Opzioni
    nell'indirizzo: `?stile=piccola|larga|entrambe` (di partenza entrambe; con la sola larga le
    schede stanno sopra la barra), `?prova=1` (partita finta, `demo.ts`, con i numeri di squadra),
    `?posizione=` (la piccola), `?scala=`, `?ritardo=` (secondi: le
    letture si tengono in coda, `delay.ts`, e si mostrano dopo il ritardo, per allinearle al
    video di YouTube che arriva con 10–20 s di ritardo) e `?intervallo=` (secondi tra due
    letture, e si ferma a scheda nascosta: lo usa la pagina `/diretta`, 8 s). La pagina dei
    genitori cambia ritardo e scala senza ricaricare la grafica con un messaggio
    (`OPTIONS_MESSAGE`, stessa origine); la grafica avvisa di essere pronta con `READY_MESSAGE`
    (un messaggio mandato prima andrebbe perso). Lo schema colori è sempre «chiaro» sia per il
    riquadro sia per il documento: se non coincidono (tema scuro del sito) il browser dipinge il
    riquadro con uno sfondo pieno (provato con un confronto di pixel in
    `e2e/diretta-pagina.spec.ts`). Mostra solo U14/U15, mai nomi né numeri di maglia.
    `PwaClient` non mostra avvisi su `/diretta*`.
    **Copia compatta del punteggio**: a ogni salvataggio dello Scout (`PUT` e `DELETE` di
    `/api/scout/[matchId]`, e la cancellazione della partita) si aggiorna, dopo la risposta
    (`after()`), `app_settings.public_live_scout` (`src/lib/scout/publicSnapshot.ts`: il
    punteggio pubblico, mai nomi, poche centinaia di byte) e l'endpoint pubblico la legge
    invece dell'intera riga dello scout; se non c'è una copia «in diretta» ripiega sulla
    lettura completa, come prima. Mai in modalità prova. Nessuna migrazione: `app_settings`
    esiste già. Il campo opzionale `PublicLiveScore.point` (SET/MATCH POINT) lo calcola
    `toPublicScoutScore`. Con lo Scout acceso ma senza ancora un punto il banner del sito non
    mostra niente (compare dal primo punto segnato), mentre la grafica riceve la partita «non
    iniziata» a 0–0 (`PublicLiveScore.notStarted`): l'endpoint la dà solo con `?prima=1`, che
    chiede la grafica, così la barra c'è appena si accende il live e in anteprima si vede
    subito. `latestPublicLive` non la fa mai prevalere su una partita già in corso.
    **Logo dell'avversaria**: la risposta pubblica aggiunge `away.logo` alle partite U14/U15
    (`src/lib/federation/teamLogos.ts`: la riga della classifica del girone più somigliante al
    nome, mai la nostra squadra, nessun logo se il nome è ambiguo; logo scelto a mano o proxy
    `/api/federation/logo`; classifiche in memoria 10 minuti), mai nella copia compatta. Senza
    logo, o se non si carica, restano le iniziali (banner del sito e grafiche).
    **Resoconto di fine set**: `PublicLiveScore.recap` (`n`, `minutes`, per squadra attacchi,
    muri, ace, `gifts` = punti da errori dell'avversaria, serie più lunga e time-out del set)
    per l'ultimo set chiuso, ricavato da `setRecapCounts` in `stats.ts` (stessa regola del
    tabellino: attacchi + muri + ace + regali fanno il punteggio del set). Solo totali di
    squadra, mai nomi né numeri di maglia; compare dopo il primo set chiuso e col Live score
    non c'è (resta la striscia «Fine set»). Il banner del sito non lo mostra.
  - **Schermo intero**: il pulsante in alto (`useStageFullscreen`, lo stesso del
    Live score: schermo intero vero dove il browser lo dà, altrimenti il
    riquadro ricopre la finestra, e si esce con «Esci» o Esc) mette lo Scout a
    tutto schermo. Con la finestra larga (da 1024 px) si divide in due colonne
    che scorrono per conto loro: pulsanti per segnare e comandi a sinistra,
    tabellone (fisso in alto), «In campo» e registro a destra (`useMediaQuery`);
    sul telefono resta una colonna sola. Il riquadro è `data-scout-stage`, le colonne
    `data-scout-main-pane` e `data-scout-log-pane`. A due colonne lo spazio si
    riempie tutto: i pulsanti dei punti (con un'icona ciascuno) si allungano
    all'altezza che resta, `ScoutEntry` li dimensiona sulla propria altezza con le
    container query (`cqh`), il campo «In campo» cresce con la finestra, il
    registro (`data-scout-log-scroll`) prende lo spazio sotto e scorre da solo,
    mentre «Annulla ultimo» e gli strumenti (`data-scout-footer`) restano sempre in
    fondo; il resto a sinistra scorre in `data-scout-main-scroll` solo se non entra.
    Le tessere di «chi» (`PlayerChips dense`) stanno in una riga (fino a 10) o in
    due di pari larghezza, così con 13–14 giocatrici i nomi si leggono ancora.
    Sotto gli 800 px di altezza (iPad piccoli, laptop) la variante `short:`
    (`globals.css`) toglie le frasi di aiuto e stringe i pulsanti; dagli 800 px in
    su restano tutte. Provato da 1024×768 a 1440×900.
  - **La palla**: la fascia «Palla nostra / Palla loro» (`ScoutBallSide.tsx`) è il
    campo visto dall'alto (Noi a sinistra, Loro a destra, la rete in mezzo) con la
    palla dalla parte giusta; si sposta passando la rete a ogni cambio e resta in
    vista sotto l'intestazione del sito (`--admin-header-h`, pubblicata da
    `AdminHeader`) o, a schermo intero, in cima. `ballOf` in `phases.ts` decide da
    che parte sta: chi batte a inizio scambio (Base), anche la nostra ricezione
    segnata (Con ricezioni). Il tabellone
    (`ScoutBoard`) la mostra accanto al nome della squadra e illumina quella metà.
  - **Fasi di gioco**: a livello Con ricezioni una striscia a tre passi
    (battuta, ricezione, punto, `FlowSteps` in `ScoutReception.tsx`) dice a che
    punto è lo scambio; `receptionOpen` in `phases.ts` dice quando la nostra
    ricezione è da segnare. Test in `unit/scout-phases.spec.ts`.
  - **Numero di maglia**: vive sull'atleta (`Athlete.jerseyNumber`, colonna
    `jersey_number smallint`, 0-99, solo U14/U15, non unico: un omonimo di
    categoria dà solo un avviso). Si scrive in Presenze > Atlete (scheda,
    «Aggiungi in elenco» con il numero prima o dopo il nome, casella «N°»
    nell'elenco: parser e regole in `src/lib/jersey.ts`) e da lì lo ripescano la
    preparazione dello Scout («Usa il N», «Compila i numeri dall'anagrafica») e
    il Live score in Partita (elenco «numero · nome» per i giocatori in campo e
    per i cambi). Se la colonna non c'è ancora su Supabase, atlete e partite
    funzionano lo stesso: il salvataggio riprova senza il numero e lo dice.
  - **Punteggio live pubblico**: lo Scout ha `settings.publicLive` (interruttore
    nella preparazione e pulsante «Punteggio live sul sito»). `/api/livescore/
    pubblico` unisce il Live score e lo Scout acceso (`getPublicLiveScout`,
    `src/lib/scout/publicScore.ts`): mai nomi né numeri, solo squadre, punti,
    set, chi batte e time-out usati; se sono accesi entrambi vince il più recente.
  - **Guida e manuale**: la guida passo passo è il tour dello Scout
    (`src/components/tour/scoutSteps.ts`, schede ricche con capitolo, esempio,
    consiglio, attenzione; parte da sola con `?guida=1` dal riquadro «Prima
    volta con lo Scout?»). Il **manuale d'uso in PDF** (`/api/scout/manuale`,
    solo con il permesso «Scout»; il pulsante «Condividi PDF», `ShareManualButton`, lo manda come file con il foglio di condivisione del telefono e sul computer lo scarica) è impaginato da `src/lib/pdf/scoutManualPdf.ts`
    sul testo di `src/lib/scout/manual.ts`, con le schermate commentate in
    `src/assets/pdf/scout-manual/`. I voti e le colonne del tabellino nel
    manuale non sono scritti a mano: i blocchi `grades` e `legend` li ricavano
    da `touches.ts` e `legend.ts`, e i rimandi «capitolo N» da `CHAPTER_ORDER`.
    Il testo del manuale usa solo caratteri Latin-1 (lo controlla un test); le
    schermate si rifanno con le atlete e le partite di prova dell'ambiente demo
    quando l'interfaccia cambia.
- **Tema chiaro/scuro** — il sito parte sempre chiaro; da un pulsante con
  sole/luna (testata del sito pubblico e pagina di accesso) o dal menu
  dell'account (area tecnici) si sceglie Chiaro, Scuro o Automatico (segue il
  dispositivo). La scelta resta su quel dispositivo (`localStorage`,
  `src/lib/theme.ts`); uno script nel `<head>` imposta
  `data-color-scheme="dark"` su `<html>` prima del primo disegno, quindi non
  c'è il lampo bianco. I colori del tema scuro sono token in
  `src/app/globals.css` (anche per il tema Minivolley): i componenti usano i
  token semantici, quindi non vanno scritti colori fissi (`bg-white`,
  `bg-sand-100`…) per i fondi dell'interfaccia.
- **App installabile (PWA) e notifiche push** — chiunque visiti il sito
  (pubblico o area riservata) può installare l'app sul proprio dispositivo e
  attivare le notifiche: viene chiesto una sola volta, la prima volta che si
  naviga il sito. Chi ha attivato le notifiche riceve un avviso quando un
  allenamento o una partita viene aggiunto, modificato o rimosso dal
  calendario. Il Developer può far riapparire a tutti il messaggio «Attiva le
  notifiche» dal Centro di controllo («Chiedi a tutti di attivare le
  notifiche»): lo rivede chi apre il sito e non le ha ancora attivate, anche
  se l'aveva chiuso da poco (richiede la tabella `app_settings` di
  `supabase/schema.sql`).
  Per arrivare anche con il telefono in risparmio energia le notifiche si
  inviano con priorità alta (`urgency: high`) e scadenza di 7 giorni, restano
  sullo schermo finché non vengono aperte o chiuse (`requireInteraction`) e il
  service worker rinnova l'iscrizione se il browser la cambia
  (`pushsubscriptionchange`); `PwaClient` controlla ogni giorno che
  l'iscrizione esista ancora e, se manca, la ricrea senza chiedere nulla. Le
  impostazioni di batteria del telefono, invece, non si possono cambiare dal
  sito: vedi i consigli in `/admin/guida`.
  Le notifiche di U14/U15 e quelle di Minivolley sono due cose distinte: ogni
  squadra ha il suo service worker, quindi la sua iscrizione sul dispositivo
  (`public/sw.js`, portata «/», per U14/U15; `public/sw-s3.js`, portata
  «/minivolley», per Minivolley, che importa lo stesso `sw.js`). Un dispositivo
  può averle tutte e due; ognuna si attiva solo dal sito della sua squadra (il
  banner «Attiva le notifiche» compare anche a chi ha già dato il permesso ma
  non ha ancora l'iscrizione di quella squadra) e niente la sposta: il sito non
  cambia mai la squadra di un'iscrizione già registrata (`planSubscription` in
  `src/lib/pushSubscribe.ts`) e l'area riservata, con qualunque squadra scelta
  nel selettore, si limita ad associare l'account alle iscrizioni che ci sono
  (`linkStaff` in `src/lib/pwa/teamPush.ts`, che raccoglie tutta la logica
  dell'iscrizione lato dispositivo). Chi aveva ancora l'iscrizione unica di
  prima passa da solo al nuovo schema: quella di Minivolley si sposta sul
  worker di Minivolley e il worker di «/» resta di U14/U15; nelle app di
  Minivolley su iPhone/iPad (un contenitore per app) si toglie, una volta, l'
  iscrizione U14/U15 che il selettore le aveva dato. Toccando una notifica si
  porta in primo piano una finestra della stessa squadra, mai quella
  dell'altra. Il Centro di controllo conta le iscrizioni per squadra (un
  dispositivo può averne due) e le elenca una per una («Iscrizioni alle
  notifiche, una per una»: squadra, account, servizio, data e fine
  dell'indirizzo), così si riconosce un dispositivo che ne ha due uguali.
  Se a qualcuno arrivano avvisi che non dovrebbero (o doppi) c'è la pagina
  «Notifiche di questo dispositivo» (`/notifiche`, e `/minivolley/notifiche` dall'
  app di Minivolley; il link è in fondo al sito pubblico;
  `src/components/pwa/NotificationSettings.tsx`). Legge dal browser le
  iscrizioni che il dispositivo (o l'app installata, su iPhone/iPad un
  contenitore per app) ha davvero e chiede al sito con quale squadra sono
  registrate (`POST /api/push/status`: dato un indirizzo restituisce solo la
  squadra, mai l'account): ogni squadra si attiva e si disattiva per conto suo,
  un'iscrizione registrata con la squadra sbagliata (o che il sito non
  conosce) si segnala e «Rimetti a posto» la toglie e ne fa una giusta, e
  «Togli tutte le notifiche da qui» toglie tutto da quel dispositivo, senza che
  niente torni da solo. La sistemazione automatica (`syncPush`) isola ogni
  passo dagli altri e, se uno fallisce, ne lascia l'ultimo errore in
  `localStorage` (`vl-pwa-push-error`, letto in «Dettagli tecnici»). Nell'app di
  Minivolley su iPhone/iPad la squadra dell'app si riconosce dalla pagina da
  cui parte l'app (`appTeam`: «/minivolley» o «/»), perché lì i contenitori
  sono separati; nell'app di una squadra la pagina segnala se sono attive
  anche le notifiche dell'altra (è il caso degli avvisi doppi). Un'iscrizione
  che chi usa il dispositivo ha attivato con un tocco (`chosen` in
  `subscribeTeam`) non viene mai tolta dalla pulizia automatica. I componenti
  browser (`browserPush.ts`) e la logica (`teamPush.ts`) condividono gli stessi
  test con un finto servizio push (`e2e/fakePush.ts`).
- **Classifiche e risultati ufficiali (FIPAV)** — il sito legge dal portale
  della federazione (stessa piattaforma per tutti i comitati, es.
  `udine.federvolley.it`) la classifica del girone di U14 e U15 e i risultati
  delle gare. La classifica è pubblica in fondo alla homepage, con il logo di
  ogni squadra (quello del portale, servito dal nostro sito e tenuto in cache;
  per Volley Lignano lo stemma del sito). In `/admin/partite` un riquadro
  dice se il sito è allineato al portale e apre `/admin/partite/portale`, la
  pagina «Portale FIPAV»: per ogni gara ufficiale un solo stato
  (`src/lib/federation/portal.ts`) e, divise per tipo, solo le cose da
  sistemare — risultati da confermare (anche tutti insieme), partite cambiate
  sul portale (data, ora, avversaria o casa/trasferta: la federazione a volte
  rivede il calendario tenendo i numeri di gara), casi da verificare con una
  domanda ciascuno (partita simile in un altro giorno: collega o aggiungi;
  gara giocata assente nel sito: aggiungi con il risultato; risultato diverso;
  partita del sito senza gara ufficiale: collega, amichevole o elimina) — più
  le partite del calendario ufficiale da aggiungere (facoltative, non segnalate
  come errore) e il calendario completo con lo stato di ogni gara. Nulla viene
  salvato finché non lo si conferma, e un risultato scritto a mano non viene mai
  sovrascritto senza una scelta esplicita. L'indirizzo del girone di ogni
  categoria si imposta dal Centro di controllo (solo Developer); `U14` resta
  nascosta finché non viene pubblicato. Se il portale non risponde si tengono
  gli ultimi dati validi con la loro data (stato in `/admin/manutenzione`).
  Dettagli e codice in `src/lib/federation/`.
- **Guida** (`/admin/guida`) — spiega il funzionamento di tutte le sezioni
  dell'area riservata. Compare automaticamente al primo accesso di un nuovo
  account e resta sempre consultabile dal menu.

## Stack tecnico

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack)
- TypeScript, Tailwind CSS v4
- [Supabase](https://supabase.com) (Postgres) come database
- Sessioni firmate con `jose` (JWT in cookie httpOnly), password con `bcryptjs`
- Pensato per il deploy su [Vercel](https://vercel.com)

## Sviluppo locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

### Modalità demo (senza Supabase)

Se le variabili d'ambiente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` non
sono impostate, l'app usa automaticamente un backend **in memoria** con dati
di esempio: puoi navigare ed esplorare tutte le funzionalità (incluso il
login come `Gaga` / `Gaga211`) senza configurare nulla. I dati vengono persi
a ogni riavvio del server — è pensata solo per provare il sito.

Nell'area riservata compare un banner giallo quando è attiva la modalità demo.

## Collegare Supabase (dati reali)

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Vai su **SQL Editor** e incolla ed esegui il contenuto di
   [`supabase/schema.sql`](./supabase/schema.sql). Crea tutte le tabelle
   (`staff`, `training_sessions`, `matches`, `athletes`,
   `attendance_sessions`, `push_subscriptions`, ecc.) con le policy di
   sicurezza (Row Level Security) necessarie. Il file è eseguibile più volte
   in sicurezza: include anche le migrazioni per chi l'aveva già lanciato
   prima che alcune colonne/tabelle venissero aggiunte.
3. Vai su **Project Settings → API** e copia:
   - `Project URL` → variabile `SUPABASE_URL`
   - `service_role` key (segreta, non la `anon` key) → variabile
     `SUPABASE_SERVICE_ROLE_KEY`
4. Crea un file `.env.local` (vedi `.env.example`):

   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxx
   SESSION_SECRET=<stringa casuale lunga, es. `openssl rand -base64 32`>

   # Facoltative: senza queste due l'app funziona normalmente ma non invia
   # notifiche push. Genera la coppia con: npx web-push generate-vapid-keys
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=
   VAPID_PRIVATE_KEY=
   VAPID_SUBJECT=mailto:info@volleylignano.it
   ```

5. Crea l'account Developer iniziale:

   ```bash
   npm run seed
   ```

   Questo crea l'utente `Gaga` con password temporanea `Gaga211` (da
   cambiare obbligatoriamente al primo accesso).

⚠️ La `service_role` key ha accesso completo al database e bypassa la
sicurezza (RLS): viene usata **solo lato server** (mai esposta al browser) e
non deve mai iniziare con `NEXT_PUBLIC_`.

## Deploy su Vercel

1. Importa il repository su [vercel.com/new](https://vercel.com/new).
2. Nelle impostazioni del progetto (**Environment Variables**) imposta:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
     (facoltative, per le notifiche push — vedi sopra)
   - `CRON_SECRET` (facoltativa: una stringa casuale lunga, serve al controllo
     giornaliero di `vercel.json` che aggiorna classifiche e risultati dalla
     federazione; senza, il sito li aggiorna comunque quando qualcuno apre una
     pagina e i dati hanno più di 30 minuti)
3. Esegui il deploy. Se non hai ancora eseguito `npm run seed`, puoi farlo
   in locale puntando alle stesse variabili d'ambiente del progetto Supabase
   collegato a Vercel.
4. Le funzioni del server girano a Francoforte (`"regions": ["fra1"]` in
   `vercel.json`), vicino al database: ogni lettura costa pochi centesimi di
   secondo invece di attraversare l'oceano. Se il progetto Supabase è in
   un'altra regione (Supabase → Project Settings → General), scegli in
   `vercel.json` la regione di Vercel più vicina.
5. Spazio delle funzioni («Functions Storage», 10 GB in tutto sul piano
   gratuito): ogni pubblicazione conserva le sue funzioni, una per pagina.
   `outputFileTracingExcludes` in `next.config.ts` ne tiene fuori sharp
   (~48 MB a funzione, inutile: su Vercel le immagini le ottimizza il suo
   servizio) e il motore delle immagini di anteprima (`@vercel/og`, serve solo
   a `/opengraph-image`). Così una pubblicazione occupa circa 0,27 GB invece
   di 3,2. Per controllare dopo una build:
   `find .next/server -name "*.nft.json" | xargs grep -l "sharp"` non deve
   trovare niente. Le pubblicazioni vecchie si cancellano da **Deployments**
   (resta sempre quella in produzione).

## Struttura del progetto

```
src/
  app/                    Pagine (App Router)
    page.tsx              Calendario pubblico
    calendario-partite.pdf/ PDF con tutte le partite (pubblico)
    login/                Login staff
    notifiche/            «Notifiche di questo dispositivo» (minivolley/notifiche/ per l'app di Minivolley)
    disponibilita/[codice]/ Pagina del genitore: «Non ci sarà» dal link personale (senza account), fino alla scadenza
    admin/                Area riservata (protetta da src/proxy.ts)
      allenamenti/        CRUD allenamenti ricorrenti
      partite/             CRUD partite (portale/: confronto con il portale FIPAV)
      assenze/             Sezione Assenze: partite (e pagina di ognuna), link per i genitori, regole delle segnalazioni
      schede/              Schede allenamento (blocchi incorporati nella scheda)
      presenze/            Registro presenze, anagrafica atlete, storico
      scout/               Scout partita: elenco, inserimento punto per punto, tabellino
      trasferte/           Trasferte: mezzi e passeggeri per partita, rubrica genitori (riservata)
      certificati/         Certificati medici: valido / in scadenza / scaduto per ogni atleta, avviso al genitore
      staff/               Creazione/modifica account admin
      guida/               Guida all'area riservata
      cambia-password/    Cambio password (obbligatorio al primo accesso)
    api/push/subscribe/    Iscrizione/cancellazione notifiche push
    api/push/status/       Con quale squadra è registrata un'iscrizione (solo la squadra)
    api/livescore/         Tabellone live (staff) e diretta pubblica (pubblico/)
    api/scout/             Scout di una partita: lettura, salvataggio con controllo di versione, PDF, manuale d'uso (manuale/)
    api/trasferte/         Riepilogo PDF di una trasferta (solo con il permesso «trasferte»)
    api/federation/refresh/ Aggiornamento classifiche dalla federazione (cron)
    api/federation/logo/   Loghi delle squadre in classifica (solo dal portale FIPAV)
  components/              Componenti UI, layout, calendario, form, PWA
  lib/
    db/                    Repository dati: implementazione Supabase + demo
    auth/                  Sessioni, password, guardie di accesso
    calendar.ts            Espansione ricorrenza allenamenti + utility
    push.ts                Invio notifiche push (web-push)
    federation/            Lettura classifiche e risultati dal portale FIPAV
    scout/                 Regole, calcolo del tabellino, salvataggio e manuale d'uso (manual.ts) dello scout
    trips/                 Trasferte: tipi, regole dei posti e delle assegnazioni, rubrica, telefoni, accesso
    availability/          Link dei genitori e assenze alle partite: codice, regole (quali partite, fino a quando, come si contano), messaggi WhatsApp
    medical/               Certificati medici: stato (valido, in scadenza da un mese prima, scaduto), controlli sulle date, messaggio al genitore
    jersey.ts              Numero di maglia: lettura dei numeri nelle righe incollate, avvisi sui doppioni
    liveScore.ts           Stato e regole del tabellone live (set, cambio campo, battuta)
    volleyRules.ts         Regole dei set e delle formule di gara, comuni a Live score e Scout
    lineup.ts              Rotazione, libero e cambi della formazione in campo, comuni a Live score e Scout
  proxy.ts                 Protezione route /admin (ex "middleware")
  instrumentation.ts       Ora italiana per tutto il server (Vercel gira in UTC)
public/
  manifest.webmanifest     Manifest PWA
  sw.js                    Service worker (notifiche push)
  sw-s3.js                 Service worker di Minivolley (portata /minivolley, importa sw.js)
  icons/                   Icone PWA
supabase/
  schema.sql               Schema SQL da eseguire su Supabase
scripts/
  seed.mjs                 Crea l'account Developer iniziale
unit/                      Test senza rete né server (npm run test:unit)
e2e/                       Test end-to-end (npm run test:e2e)
vercel.json                Regione delle funzioni (fra1) e controllo giornaliero delle classifiche (cron)
```

## Prossimi sviluppi possibili

- Pagina profilo squadra, foto
- Esportazione calendario (iCal) per Google Calendar / Apple Calendar
