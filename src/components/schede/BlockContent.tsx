import { cn } from "@/lib/cn";

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function BlockContent({ content, className }: { content: string; className?: string }) {
  const paragraphs = splitParagraphs(content);

  if (paragraphs.length === 0) {
    return <p className={cn("text-sm italic text-foreground/40", className)}>Nessuna descrizione.</p>;
  }

  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed text-foreground/75", className)}>
      {paragraphs.map((para, i) => {
        const lines = para
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const isBullet = lines.every((l) => /^[*-]\s+/.test(l));
        const isNumbered = lines.every((l) => /^\d+[.)]\s+/.test(l));

        if (isBullet) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-sea-500">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^[*-]\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        if (isNumbered) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-sea-500 marker:font-semibold">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\d+[.)]\s+/, "")}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {l}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
