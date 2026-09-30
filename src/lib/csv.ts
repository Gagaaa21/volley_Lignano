/** Racchiude un campo tra virgolette (raddoppiando quelle interne) solo se
 * contiene virgola, virgolette o un a-capo — lo stesso criterio minimo
 * richiesto dal formato CSV (RFC 4180), niente virgolette superflue sui
 * campi semplici. */
export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Costruisce un file CSV completo (intestazione + righe), terminatore
 * CRLF come da RFC 4180 (il più compatibile con Excel). */
export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cols) => cols.map(csvEscape).join(","));
  return lines.join("\r\n") + "\r\n";
}
