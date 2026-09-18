export function PublicFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-2 text-center text-sm text-foreground/60 sm:flex-row sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} Volley Lignano — Settore Giovanile Femminile</p>
          <p>Under 14 &amp; Under 15 · Lignano Sabbiadoro</p>
        </div>
      </div>
    </footer>
  );
}
