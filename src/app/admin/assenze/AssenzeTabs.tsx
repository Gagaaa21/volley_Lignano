import { SegmentedLinks } from "@/components/ui/Segmented";

export type AssenzeTab = "partite" | "link" | "regole";

/** Le tre parti della sezione Assenze: le partite (chi manca e fino a quando si segnala), i link da mandare ai genitori, le regole. */
export function AssenzeTabs({ active }: { active: AssenzeTab }) {
  return (
    <SegmentedLinks
      stretch
      ariaLabel="Parti della sezione Assenze"
      dataTour="section-assenze-tabs"
      className="mb-6"
      items={[
        { href: "/admin/assenze", label: "Partite", active: active === "partite" },
        { href: "/admin/assenze/link", label: "Link per i genitori", active: active === "link" },
        { href: "/admin/assenze/regole", label: "Regole", active: active === "regole" },
      ]}
    />
  );
}
