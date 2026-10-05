import type { StaticImageData } from "next/image";
import factoryVolleyFaedis from "@/assets/team-logos/factory-volley-faedis.png";
import pavBressa from "@/assets/team-logos/pav-bressa.png";
import projectVolleyOlimpia from "@/assets/team-logos/project-volley-olimpia.png";
import { manualLogoKey } from "@/lib/federation/teamName";

/** File dei loghi scelti a mano, per chiave (l'elenco delle squadre è in teamName.ts). */
const IMAGES: Record<string, StaticImageData> = {
  "factory-volley-faedis": factoryVolleyFaedis,
  "pav-bressa": pavBressa,
  "project-volley-olimpia": projectVolleyOlimpia,
};

/** Logo scelto a mano per una squadra del girone; null se si usa quello del portale. */
export function manualLogoFor(teamName: string): StaticImageData | null {
  const key = manualLogoKey(teamName);
  return key ? (IMAGES[key] ?? null) : null;
}
