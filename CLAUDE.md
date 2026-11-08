@AGENTS.md

# Ordini del proprietario del sito

- **Minivolley: da ignorare, fino a nuovo ordine.** Quando si fanno modifiche, valgono per U14/U15: il Minivolley non si tocca, non si prova e non si estende (se una pagina è in comune, il Minivolley segue da sé, ma non gli si dedica lavoro né test). Il proprietario dirà quando togliere questa regola.
- **Usare le skill gratuite.** Ogni volta che serve, si usano tutte le skill gratuite che aiutano a finire il lavoro più in fretta e meglio (es. security-review, code-review, simplify, run).
- **Supabase: interventi autorizzati in automatico.** Migrazioni SQL, controlli, correzioni di permessi, indici e impostazioni sul progetto Supabase si fanno senza chiedere; ogni modifica allo schema va riportata anche in `supabase/schema.sql`.
- **Diretta: MAI le statistiche di una singola atleta.** Nella grafica della diretta in partita (e in tutto ciò che è pubblico: punteggio live, /diretta, /diretta/grafica) le statistiche sono solo di squadra (attacchi, muri, ace, errori dell'avversaria, serie, time-out). Delle nostre atlete esce solo il numero di maglia, e il nome se lo staff lo accende, in formazione e cambi: mai punti, ace, attacchi, «migliore in campo» o simili di una singola. Lo controlla la prova «mai le statistiche di una singola atleta» in `unit/scout-public.spec.ts`.
- **Pubblicare subito, poi provare.** Finite le modifiche (e passati i controlli veloci: tsc, eslint, prove unitarie, build), si pubblica subito sul ramo (che va in produzione); le prove complete nel browser continuano dopo e, se qualcosa fallisce, si corregge e si pubblica di nuovo. Non si aspetta la fine delle prove nel browser per pubblicare.
