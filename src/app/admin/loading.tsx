// Scheletro leggero mostrato subito durante la navigazione tra le pagine
// dell'area riservata, mentre i dati della pagina di destinazione vengono
// letti da Supabase: senza questo file la pagina restava bianca per tutto
// quel tempo, dando l'impressione di un sito bloccato o lentissimo.
export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="mb-8 space-y-3">
        <div className="h-8 w-60 rounded-xl bg-muted" />
        <div className="h-4 w-80 max-w-full rounded-full bg-muted/80" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[6.5rem] rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <div className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-48 max-w-full rounded-full bg-muted" />
              <div className="h-3 w-32 rounded-full bg-muted/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
