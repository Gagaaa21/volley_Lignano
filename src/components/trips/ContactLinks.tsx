import { Phone } from "lucide-react";
import { phoneHref } from "@/lib/trips/phone";
import type { AthleteContact } from "@/lib/trips/types";

/** I numeri di chi chiamare per un'atleta, ognuno un link che dal telefono fa partire la chiamata. */
export function ContactLinks({ contacts }: { contacts: AthleteContact[] }) {
  if (contacts.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1" data-contact-links>
      {contacts.map((contact) => {
        const href = phoneHref(contact.phone);
        return (
          <li key={`${contact.name}-${contact.phone}`} className="text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{contact.relation ? `${contact.relation} · ${contact.name}` : contact.name}</span>{" "}
            {href ? (
              <a href={href} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" data-contact-phone>
                <Phone className="h-3 w-3" aria-hidden />
                {contact.phone}
              </a>
            ) : (
              contact.phone
            )}
          </li>
        );
      })}
    </ul>
  );
}
