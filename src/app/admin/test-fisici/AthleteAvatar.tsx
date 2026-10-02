function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Cerchio con le iniziali dell'atleta, stesso ruolo visivo dell'avatar
 * circolare nelle schermate dell'app di riferimento (lì un'icona
 * generica su sfondo grigio; qui le iniziali sui colori del sito). */
export function AthleteAvatar({ fullName, className }: { fullName: string; className?: string }) {
  return (
    <span
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-base font-bold text-primary ${className ?? ""}`}
    >
      {initials(fullName)}
    </span>
  );
}
