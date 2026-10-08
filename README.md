# Volley Lignano

Sito per la gestione della squadra femminile Under 14 e Under 15 di Volley
Lignano: calendario pubblico di allenamenti e partite, area riservata per lo
staff (Developer e Admin).

## Funzionalità incluse

- **Calendario pubblico** (`/`) — vista mensile + agenda con allenamenti
  ricorrenti (congiunti U14/U15) e partite, filtrabile per categoria.
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
  data si può saltare oppure spostare (orario e/o luogo diversi solo quel
  giorno, dalla pagina della data: "Orario e luogo di questo giorno"); le
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
  scheda): si vede la divisione proposta e si applica con un clic.
- **Presenze** (`/admin/presenze`) — registro presenze legato agli
  allenamenti del calendario: si sceglie l'allenamento da registrare e per
  ogni atleta si segna Presente/Assente (di default tutte presenti), con
  Assenza giustificata/non giustificata come dettaglio dell'assenza.
  Anagrafica atlete gestibile in `/admin/presenze/atlete` (una alla volta o
  incollando un elenco di più nominativi insieme in
  `/admin/presenze/atlete/elenco`; la categoria U14/U15 è facoltativa e
  assegnabile anche in un secondo momento), storico dei registri salvati
  (anche per singola atleta) in `/admin/presenze/storico`.
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
  per Volley Lignano lo stemma del sito). In `/admin/partite` l'elenco
  «Partite registrate» è separato dal riquadro «Collegamento con il portale
  FIPAV» (in fondo, raggiungibile da `#portale`), dove gli admin
  trovano i risultati come proposte e le partite del campionato che nel sito
  mancano, da aggiungere al calendario con anteprima e conferma (senza
  duplicare quelle già inserite) e le avvisano se il portale ha cambiato una
  partita già in calendario (data, ora, avversaria o casa/trasferta: la
  federazione a volte rivede il calendario tenendo i numeri di gara e
  cambiando gli abbinamenti; si aggiorna con un clic, palestra compresa) o se
  una partita del sito non corrisponde a nessuna gara ufficiale (le partite del
  portale non ancora inserite non sono un errore e non vengono segnalate nella
  dashboard): nulla viene salvato finché non lo si conferma, e un risultato scritto a mano non viene mai
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

## Struttura del progetto

```
src/
  app/                    Pagine (App Router)
    page.tsx              Calendario pubblico
    login/                Login staff
    admin/                Area riservata (protetta da src/proxy.ts)
      allenamenti/        CRUD allenamenti ricorrenti
      partite/             CRUD partite
      schede/              Schede allenamento (blocchi incorporati nella scheda)
      presenze/            Registro presenze, anagrafica atlete, storico
      staff/               Creazione/modifica account admin
      guida/               Guida all'area riservata
      cambia-password/    Cambio password (obbligatorio al primo accesso)
    api/push/subscribe/    Iscrizione/cancellazione notifiche push
    api/federation/refresh/ Aggiornamento classifiche dalla federazione (cron)
    api/federation/logo/   Loghi delle squadre in classifica (solo dal portale FIPAV)
  components/              Componenti UI, layout, calendario, form, PWA
  lib/
    db/                    Repository dati: implementazione Supabase + demo
    auth/                  Sessioni, password, guardie di accesso
    calendar.ts            Espansione ricorrenza allenamenti + utility
    push.ts                Invio notifiche push (web-push)
    federation/            Lettura classifiche e risultati dal portale FIPAV
  proxy.ts                 Protezione route /admin (ex "middleware")
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
vercel.json                Controllo giornaliero delle classifiche (cron)
```

## Prossimi sviluppi possibili

- Pagina profilo squadra, foto
- Esportazione calendario (iCal) per Google Calendar / Apple Calendar
