import { whatsappPhone } from "@/lib/trips/phone";
import { daysBeforePhrase } from "./reporting";
import { REPORT_CLOSES_DAYS_BEFORE } from "./types";

/** Il messaggio che lo staff manda al genitore con il link personale (con i giorni delle regole di adesso): assenze e certificato medico. */
export function familyLinkMessage(athleteName: string, url: string, daysBefore: number = REPORT_CLOSES_DAYS_BEFORE): string {
  const until = daysBefore === 0 ? "fino all'inizio della partita" : `fino a ${daysBeforePhrase(daysBefore)}`;
  return [
    `Ciao! Questo è il link personale di ${athleteName} per avvisarci se non può esserci a una partita (${until}) e per scriverci le date del certificato medico:`,
    url,
    "È solo per voi: non condividerlo con altri.",
  ].join("\n");
}

/** Apre WhatsApp con il messaggio già scritto: sul numero indicato, se è valido, altrimenti a scegliere la chat. */
export function whatsappShareUrl(phone: string | null, text: string): string {
  const number = phone ? whatsappPhone(phone) : null;
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}
