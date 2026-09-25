// Scheletro leggero mostrato subito durante la navigazione tra le pagine
// dell'area riservata, mentre i dati della pagina di destinazione vengono
// letti da Supabase: senza questo file la pagina restava bianca per tutto
// quel tempo, dando l'impressione di un sito bloccato o lentissimo.
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="space-y-2.5">
        <div className="h-3 w-24 rounded-full bg-surface-muted" />
        <div className="h-7 w-56 rounded-lg bg-surface-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-border-subtle bg-surface" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl border border-border-subtle bg-surface" />
        ))}
      </div>
    </div>
  );
}
