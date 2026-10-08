import { cn } from "@/lib/cn";
import { parseBlockContent } from "@/lib/blockContent";

export function BlockContent({ content, className }: { content: string; className?: string }) {
  const parts = parseBlockContent(content);

  if (parts.length === 0) {
    return <p className={cn("text-sm italic text-foreground/40", className)}>Nessuna descrizione.</p>;
  }

  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed text-foreground/75", className)}>
      {parts.map((part, i) => {
        if (part.kind === "bullets") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-sea-500">
              {part.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        if (part.kind === "numbered") {
          // Si tengono i numeri scritti dall'allenatore: un elenco interrotto da altre righe
          // ("1. Attacchi a muro", poi i punti, poi "2. Attacchi da Z4") non riparte da 1.
          // Una riga numerata da sola è il titolo di un esercizio: in evidenza.
          return (
            <ol
              key={i}
              start={part.items[0].number}
              className={cn(
                "list-decimal space-y-1 pl-5 marker:font-semibold marker:text-sea-500",
                part.items.length === 1 && "pt-1 font-semibold text-foreground",
              )}
            >
              {part.items.map((item, j) => (
                <li key={j} value={item.number}>
                  {item.text}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {part.lines.map((line, j) => (
              <span key={j}>
                {line}
                {j < part.lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
