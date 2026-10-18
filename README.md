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
  avversario, casa/trasferta, data/ora, luogo.
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
  sito (anche il tabellino e il manuale dello Scout, le formazioni di gara) ha
  «Scarica» e «Condividi PDF» (`src/components/pdf/SharePdfButton.tsx`): dal
  telefono apre il foglio di condivisione con il file già allegato, altrove
  scarica; il file si prepara in anticipo (`prefetch`) o al primo tocco.
  Il calendario partite ha nel PDF una colonna con «U14»/«U15» su riquadro
  pieno e una barra del colore della categoria sulla riga; i nomi dei file di
  tabellino e formazioni portano la categoria.
- **Pronostici** (`src/lib/predictions.ts`) — si aprono il giorno della
  partita e si chiudono **un'ora dopo l'inizio** (`PREDICTION_GRACE_MINUTES`),
  o subito se il risultato è già stato inserito; pagina e azione dicono
  l'orario di chiusura. Dopo la chiusura i pronostici di tutti diventano
  visibili.
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
  secondi mentre la pagina è visibile. È un tabellone scuro, uguale con ogni
  tema: stemma (o iniziali nel colore scelto per l'avversaria), punteggio
  grande, set vinti, due pallini dei time-out per squadra e i parziali dei
  set chiusi.
- **Scout** (`/admin/scout`, permesso «Scout», regole in `src/lib/scout/`) —
  si segna la partita scambio per scambio, al **livello** scelto prima di ogni
  partita (`settings.level`, `levels.ts`): **Base** (chi fa punto e come, come
  negli scout dei campionati ufficiali con Data Volley), **Con ricezioni** (in
  più la nostra ricezione, con voto e zona) o **Completo** (ogni tocco, vedi
  sotto). A livello Base: attacco, muro, ace, oppure l'errore o il
  fallo dell'altra squadra (`rules.ts`: battuta, ricezione, attacco, muro,
  alzata, difesa, rete, invasione, doppia, trattenuta, quattro tocchi,
  rotazione, sanzione), con la giocatrice se si sa. Si salvano **solo gli
  scambi** (`events`, riga per partita in `match_scouts`, campo `data` jsonb):
  punteggi, set vinti, chi batte, break point e cambio palla si ricavano ogni
  volta (`derive.ts`), quindi correggere o annullare uno scambio non può
  mandare niente fuori sincrono. Le regole dei set sono quelle FIPAV (25 con 2
  di scarto, ultimo set a 15; 3 set su 5, 2 su 3 o 3 fissi). Il tabellino
  (`stats.ts`, pagina `/admin/scout/[matchId]/tabellino` e PDF in
  `src/lib/pdf/scoutPdf.ts`) ricalca le colonne di quello di Lega che si
  possono compilare senza segnare ogni tocco: punti, BP, V-P, ace, errori,
  attacchi vincenti/sbagliati/murati, muri, più «come si è fatto punto»,
  errori e falli, andamento del punteggio e riepilogo di stagione; a livello
  Base non ci sono attacchi tentati né percentuali di attacco e ricezione
  (arrivano con i livelli superiori, vedi sotto). Il salvataggio
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
    (`levelOf`, `normalizeSettings`). Con ricezioni e Completo, oltre agli
    scambi si salvano i **tocchi** (`ScoutTouchEvent`, voti `# + ! - / =`,
    zona 1-6 facoltativa, regole in `touches.ts`): un voto che chiude lo
    scambio (errore, ace, attacco a terra, muro vincente) assegna il punto da
    solo, gli altri lasciano lo scambio aperto (`pending`) finché un altro
    tocco o un esito scelto a mano lo chiude. `derive.ts` ricostruisce tutto
    dagli eventi; `effectiveTouches` rende uguali i conti di chi segna a
    punto e di chi segna ogni tocco. `stats.ts` ricava ricezione, attacchi
    totali, efficienza, difese, zone e rotazioni (si parte dalla 1ª a ogni set
    e si avanza a ogni cambio palla: senza formazioni sono indicative). Le
    colonne del tabellino sono in `columns.ts` e la legenda in `legend.ts`,
    usate insieme dalla pagina e dal PDF. Inserimento: scheda della
    ricezione (`ScoutReception.tsx`: quando battono loro si apre da sola una
    finestra, la stessa dei tasti dei punti (`ScoutSheet.tsx`), con il campo a
    sinistra dove si tocca chi ha ricevuto, i voti grandi a destra, la zona
    (facoltativa), la panchina e «Non so»; senza formazione una riga di numeri;
    si chiude con «Salta la ricezione» o Esc, toccare fuori non la chiude, e in
    pagina resta una riga con «Segna la ricezione» per riaprirla; a set finito
    non si apre) e schermata dei tocchi
    (`ScoutTouchEntry.tsx`, con i pulsanti dei punti in «Falli, sanzioni o
    solo il punto»); correzione dei tocchi dal Registro.
  - **Formazione in campo** (facoltativa, come nel Live score): si scrive
    nella preparazione (`ScoutLineupEditor.tsx`, subito sotto le giocatrici) o
    nella finestra «Formazione» (`ScoutLineupSheet`: dal pulsante «Formazione»,
    da «Segui la formazione» o da sola a ogni set nuovo, quando `setLineupPending`
    in `court.ts` dice che nessuno l'ha ancora scritta per quel set). Parte da
    quella preparata in Partita per quel set, altrimenti da quella del set
    prima: «Comincia» (`commitRef`) applica da sola quella scritta e non
    ancora confermata, quindi non va riscritta due volte. Chi gioca nelle sei
    posizioni, la libero e le due centrali che sostituisce. Due eventi in più nello scout,
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
    numeri, con un avviso per impostarla). Il cambio disegna lo stesso campo con
    numero e nome di ognuna e ha «Cambia la libero» (non conta tra i cambi: è un
    evento `lineup` con la libero nuova); formazioni di partenza e cambi nel tabellino
    (`src/components/scout/ScoutLineups.tsx`) e nel PDF
    (`lineupSections` in `scoutPdf.ts`). Nessuna migrazione: sono eventi nel
    `data` jsonb, e gli scout vecchi si leggono come prima.
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
    anche da mettere in OBS come «Sorgente browser» 1920×1080. Legge `/api/livescore/pubblico`
    (stesso punteggio del banner) e disegna la barra del punteggio
    (`src/components/diretta/Scorebug.tsx`: battuta, time-out, set vinti, punti, parziali,
    SET/MATCH POINT) e le schede di time-out, fine set e finale (`Cards.tsx`). Le misure sono in
    `rem` con `html { font-size }` legato alla larghezza dello schermo, quindi scala con
    qualunque dimensione. Cosa è cambiato tra due letture è logica pura in
    `src/lib/diretta/overlayEvents.ts` (`diffLive`, `feedReducer`). Opzioni nell'indirizzo:
    `?prova=1` (partita finta, `demo.ts`), `?posizione=`, `?scala=`, `?ritardo=` (secondi: le
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
    `toPublicScoutScore`. Con lo Scout acceso ma senza ancora un punto il sito (e la grafica)
    non mostra niente: la barra compare dal primo punto segnato.
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
    segnata (Con ricezioni), chi tocca adesso (Completo). Il tabellone
    (`ScoutBoard`) la mostra accanto al nome della squadra e illumina quella metà.
  - **Fasi di gioco**: nei livelli Con ricezioni e Completo la schermata dice
    sempre **di chi è il turno e quale fase viene adesso** (battuta,
    ricezione, alzata, attacco, muro, difesa). Il percorso della palla e il
    riquadro «Ora tocca a» (`ScoutPhaseBanner.tsx`) leggono
    `suggestNext`/`flowAfter`/`describeNext` in `touches.ts`; i sei passi
    dell'alternanza, uguali in app e nel manuale, sono in `phases.ts`
    (`PHASE_STEPS`, `PHASE_FLOW`). Test in `unit/scout-phases.spec.ts`.
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

## Struttura del progetto

```
src/
  app/                    Pagine (App Router)
    page.tsx              Calendario pubblico
    calendario-partite.pdf/ PDF con tutte le partite (pubblico)
    login/                Login staff
    admin/                Area riservata (protetta da src/proxy.ts)
      allenamenti/        CRUD allenamenti ricorrenti
      partite/             CRUD partite (portale/: confronto con il portale FIPAV)
      schede/              Schede allenamento (blocchi incorporati nella scheda)
      presenze/            Registro presenze, anagrafica atlete, storico
      scout/               Scout partita: elenco, inserimento punto per punto, tabellino
      staff/               Creazione/modifica account admin
      guida/               Guida all'area riservata
      cambia-password/    Cambio password (obbligatorio al primo accesso)
    api/push/subscribe/    Iscrizione/cancellazione notifiche push
    api/livescore/         Tabellone live (staff) e diretta pubblica (pubblico/)
    api/scout/             Scout di una partita: lettura, salvataggio con controllo di versione, PDF, manuale d'uso (manuale/)
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
    jersey.ts              Numero di maglia: lettura dei numeri nelle righe incollate, avvisi sui doppioni
    liveScore.ts           Stato e regole del tabellone live (set, cambio campo, battuta)
    volleyRules.ts         Regole dei set e delle formule di gara, comuni a Live score e Scout
    lineup.ts              Rotazione, libero e cambi della formazione in campo, comuni a Live score e Scout
  proxy.ts                 Protezione route /admin (ex "middleware")
  instrumentation.ts       Ora italiana per tutto il server (Vercel gira in UTC)
public/
  manifest.webmanifest     Manifest PWA
  sw.js                    Service worker (notifiche push)
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
