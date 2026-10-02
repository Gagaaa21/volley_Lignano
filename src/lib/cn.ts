import { twMerge } from "tailwind-merge";

/** Unisce classi Tailwind risolvendo i conflitti (l'ultima vince): senza
 * twMerge un override come `text-destructive` passato a un Button "ghost"
 * convive con il `text-primary` della variante e il colore effettivo
 * dipende dall'ordine del CSS generato, non da quello scritto qui. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
