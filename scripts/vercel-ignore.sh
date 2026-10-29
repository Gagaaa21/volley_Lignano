#!/usr/bin/env bash
# «Ignored Build Step» di Vercel (vercel.json → ignoreCommand): esce con 0 se la pubblicazione si può saltare, con 1 se va fatta.
#
# Il piano gratuito ha 10 GB di «Function Storage» in tutto e ogni pubblicazione conserva le sue funzioni (circa 0,28 GB).
# Una modifica che riguarda solo le prove (e2e, unit), la documentazione o gli script non cambia il sito: pubblicarla
# riempirebbe lo spazio per niente. Nel dubbio si pubblica: ogni caso incerto esce con 1.
#
# VERCEL_GIT_PREVIOUS_SHA è l'ultimo commit pubblicato con successo su questo ramo; manca alla prima pubblicazione.

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$previous" ] || ! git cat-file -e "$previous^{commit}" 2>/dev/null; then
  echo "Nessun commit precedente raggiungibile: si pubblica."
  exit 1
fi

# Tutto ciò che non finisce nel sito pubblicato. Il resto (src, public, package*.json, next.config.ts, vercel.json…) conta.
if git diff --quiet "$previous" HEAD -- . \
  ':(exclude)e2e' \
  ':(exclude)unit' \
  ':(exclude)scripts' \
  ':(exclude)supabase' \
  ':(exclude)README.md' \
  ':(exclude)CLAUDE.md' \
  ':(exclude)AGENTS.md' \
  ':(exclude)playwright.config.ts' \
  ':(exclude)playwright.unit.config.ts'; then
  echo "Dall'ultima pubblicazione cambiano solo prove, documentazione o script: si salta."
  exit 0
fi

echo "Cambia qualcosa che finisce nel sito: si pubblica."
exit 1
