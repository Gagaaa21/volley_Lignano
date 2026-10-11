/** Identificativo per uno scambio o una giocatrice scritta a mano. `randomUUID` esiste solo su pagine sicure (https): altrimenti se ne costruisce uno. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
