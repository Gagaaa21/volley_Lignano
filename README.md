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
- **Gestione allenamenti** (`/admin/allenamenti`) — regole ricorrenti per
  giorno della settimana, orario, luogo e periodo di validità.
- **Gestione partite** (`/admin/partite`) — partite per categoria (U14/U15),
  avversario, casa/trasferta, data/ora, luogo.
- **Gestione staff** (`/admin/staff`) — creazione nuovi account admin con
  password temporanea.
- **Schede allenamento** (`/admin/schede`) — visibili solo a Developer e
  Admin. Incolla il testo di un allenamento (es. "1. TITOLO – 10' ...") e
  viene diviso automaticamente in macro blocchi riutilizzabili in stile
  puzzle (libreria in `/admin/schede/blocchi`): modificando un blocco si
  aggiorna ovunque venga usato, e le schede successive si compongono
  riordinando/riusando i blocchi esistenti.
- **Presenze** (`/admin/presenze`) — sezione riservata, per ora segnaposto
  "in costruzione".

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
   [`supabase/schema.sql`](./supabase/schema.sql). Crea le tabelle
   `staff`, `training_sessions`, `matches` con le policy di sicurezza
   (Row Level Security) necessarie.
3. Vai su **Project Settings → API** e copia:
   - `Project URL` → variabile `SUPABASE_URL`
   - `service_role` key (segreta, non la `anon` key) → variabile
     `SUPABASE_SERVICE_ROLE_KEY`
4. Crea un file `.env.local` (vedi `.env.example`):

   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxx
   SESSION_SECRET=<stringa casuale lunga, es. `openssl rand -base64 32`>
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
      staff/               Creazione account admin
      cambia-password/    Cambio password (obbligatorio al primo accesso)
  components/              Componenti UI, layout, calendario, form
  lib/
    db/                    Repository dati: implementazione Supabase + demo
    auth/                  Sessioni, password, guardie di accesso
    calendar.ts            Espansione ricorrenza allenamenti + utility
  proxy.ts                 Protezione route /admin (ex "middleware")
supabase/
  schema.sql               Schema SQL da eseguire su Supabase
scripts/
  seed.mjs                 Crea l'account Developer iniziale
```

## Prossimi sviluppi possibili

- Notifiche (email/push) per nuove partite o variazioni di orario
- Pagina profilo squadra, foto, classifiche
- Esportazione calendario (iCal) per Google Calendar / Apple Calendar
