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
  giorno della settimana, orario, luogo e periodo di validità.
- **Gestione partite** (`/admin/partite`) — partite per categoria (U14/U15),
  avversario, casa/trasferta, data/ora, luogo.
- **Gestione staff** (`/admin/staff`) — creazione nuovi account admin con
  password temporanea. Un Developer può anche modificare il nome utente di
  un Admin o impostargli una nuova password temporanea.
- **Schede allenamento** (`/admin/schede`) — visibili solo a Developer e
  Admin. Incolla il testo di un allenamento (es. "1. TITOLO – 10' ...") e
  viene diviso automaticamente in macro blocchi riutilizzabili in stile
  puzzle (libreria in `/admin/schede/blocchi`): modificando un blocco si
  aggiorna ovunque venga usato, e le schede successive si compongono
  riordinando/riusando i blocchi esistenti.
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
  calendario.
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
      schede/              Blocchi e schede allenamento riutilizzabili
      presenze/            Registro presenze, anagrafica atlete, storico
      staff/               Creazione/modifica account admin
      guida/               Guida all'area riservata
      cambia-password/    Cambio password (obbligatorio al primo accesso)
    api/push/subscribe/    Iscrizione/cancellazione notifiche push
  components/              Componenti UI, layout, calendario, form, PWA
  lib/
    db/                    Repository dati: implementazione Supabase + demo
    auth/                  Sessioni, password, guardie di accesso
    calendar.ts            Espansione ricorrenza allenamenti + utility
    push.ts                Invio notifiche push (web-push)
  proxy.ts                 Protezione route /admin (ex "middleware")
public/
  manifest.webmanifest     Manifest PWA
  sw.js                    Service worker (notifiche push)
  icons/                   Icone PWA
supabase/
  schema.sql               Schema SQL da eseguire su Supabase
scripts/
  seed.mjs                 Crea l'account Developer iniziale
```

## Prossimi sviluppi possibili

- Pagina profilo squadra, foto, classifiche
- Esportazione calendario (iCal) per Google Calendar / Apple Calendar
