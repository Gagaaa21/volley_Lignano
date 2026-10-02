import { Avatar } from "@/components/ui/Avatar";

/** Cerchio con le iniziali dell'atleta, stesso ruolo visivo dell'avatar
 * circolare nelle schermate dell'app di riferimento: ora un alias
 * dell'Avatar condiviso, per avere ovunque lo stesso aspetto. */
export function AthleteAvatar({ fullName, className }: { fullName: string; className?: string }) {
  return <Avatar name={fullName} size="lg" className={className} />;
}
