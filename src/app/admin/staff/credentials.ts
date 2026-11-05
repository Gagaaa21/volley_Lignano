/** Il messaggio con le credenziali da mandare (WhatsApp, SMS): copiato così com'è, senza rischi di riscriverle male. */
export function credentialsText({ username, password }: { username: string; password: string }): string {
  return [
    "Accesso all'area tecnici",
    `Nome utente: ${username}`,
    `Password: ${password}`,
    "Al primo accesso ti chiede di sceglierne una tua.",
  ].join("\n");
}
