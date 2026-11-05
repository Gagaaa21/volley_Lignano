@AGENTS.md

# Ordini del proprietario del sito

- **Minivolley: da ignorare, fino a nuovo ordine.** Quando si fanno modifiche, valgono per U14/U15: il Minivolley non si tocca, non si prova e non si estende (se una pagina è in comune, il Minivolley segue da sé, ma non gli si dedica lavoro né test). Il proprietario dirà quando togliere questa regola.
- **Usare le skill gratuite.** Ogni volta che serve, si usano tutte le skill gratuite che aiutano a finire il lavoro più in fretta e meglio (es. security-review, code-review, simplify, run).
- **Supabase: interventi autorizzati in automatico.** Migrazioni SQL, controlli, correzioni di permessi, indici e impostazioni sul progetto Supabase si fanno senza chiedere; ogni modifica allo schema va riportata anche in `supabase/schema.sql`.
- **Pubblicare subito, poi provare.** Finite le modifiche (e passati i controlli veloci: tsc, eslint, prove unitarie, build), si pubblica subito sul ramo (che va in produzione); le prove complete nel browser continuano dopo e, se qualcosa fallisce, si corregge e si pubblica di nuovo. Non si aspetta la fine delle prove nel browser per pubblicare.
