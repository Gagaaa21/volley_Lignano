import type { MinivolleyGroup } from "@/lib/types";

/** Uniforma un nome (spazi doppi, maiuscole/minuscole) così che la stessa
 * persona, scritta in momenti diversi, conti come la stessa voce a
 * prescindere da come è stata digitata quella volta. Usato dall'aggiunta in
 * blocco delle atlete Minivolley per ripulire nome/cognome incollati. */
export function normalizePersonName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

/** Una riga dell'elenco incollato per l'aggiunta in blocco delle atlete
 * Minivolley: "Gruppo<TAB>Nome<TAB>Cognome" (nome/cognome anche multi-
 * parola). Tollerante come l'aggiunta in blocco U14/U15: una riga che non
 * si divide in almeno 3 campi non tab-separati diventa comunque un nome
 * valido, solo senza gruppo, invece di un errore bloccante. */
export function parseMinivolleyBulkLine(line: string): { fullName: string; group: MinivolleyGroup | null } {
  const fields = line
    .split("\t")
    .map((f) => f.trim())
    .filter(Boolean);

  if (fields.length < 3) {
    return { fullName: normalizePersonName(line), group: null };
  }

  const [groupRaw, ...nameParts] = fields;
  const fullName = normalizePersonName(nameParts.join(" "));
  const groupLower = groupRaw.toLowerCase();
  const group: MinivolleyGroup | null = groupLower.includes("lignano")
    ? "lignano"
    : groupLower.includes("san michele")
      ? "san_michele"
      : null;

  return { fullName, group };
}
