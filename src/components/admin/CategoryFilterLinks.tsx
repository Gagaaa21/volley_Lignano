import { SegmentedLinks } from "@/components/ui/Segmented";
import { CATEGORY_LABELS } from "@/lib/category";
import type { Category } from "@/lib/types";

/**
 * Il filtro «Tutte / Under 14 / Under 15» di una pagina dell'area tecnici: link con `?cat=` (niente JS). Gli altri
 * parametri della pagina (`params`, per esempio la vista) restano com'erano.
 */
export function CategoryFilterLinks({
  path,
  active,
  params = {},
  dataTour,
  className,
}: {
  path: string;
  active: "all" | Category;
  params?: Record<string, string | undefined>;
  dataTour?: string;
  className?: string;
}) {
  const hrefFor = (value: "all" | Category) => {
    const query = new URLSearchParams();
    for (const [key, v] of Object.entries(params)) if (v) query.set(key, v);
    if (value !== "all") query.set("cat", value);
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
  };
  return (
    <SegmentedLinks
      ariaLabel="Filtra per categoria"
      dataTour={dataTour}
      className={className}
      items={(["all", "U14", "U15"] as const).map((value) => ({
        href: hrefFor(value),
        label: value === "all" ? "Tutte" : CATEGORY_LABELS[value],
        active: active === value,
      }))}
    />
  );
}
