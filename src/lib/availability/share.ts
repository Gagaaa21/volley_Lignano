import { whatsappPhone } from "@/lib/trips/phone";

/** Il messaggio che lo staff manda al genitore con il link personale. */
export function familyLinkMessage(athleteName: string, url: string): string {
  return [
    `Ciao! Questo è il link personale di ${athleteName} per avvisare se non può esserci a una partita:`,
    url,
    "È solo per voi: non condividerlo con altri.",
  ].join("\n");
}

/** Apre WhatsApp con il messaggio già scritto: sul numero indicato, se è valido, altrimenti a scegliere la chat. */
export function whatsappShareUrl(phone: string | null, text: string): string {
  const number = phone ? whatsappPhone(phone) : null;
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}
