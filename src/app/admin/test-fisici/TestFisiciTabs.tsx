import Link from "next/link";
import { Table2, Users } from "lucide-react";
import { cn } from "@/lib/cn";

/** Le due viste dei test fisici: l'elenco delle atlete (si entra nello storico di una) e il riepilogo con tutti i risultati in una tabella. */
export function TestFisiciTabs({ active }: { active: "atlete" | "riepilogo" }) {
  const tab = (isActive: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
      isActive ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <nav aria-label="Vista dei test fisici" className="mb-5 inline-flex rounded-xl bg-muted p-1">
      <Link
        href="/admin/test-fisici"
        className={tab(active === "atlete")}
        aria-current={active === "atlete" ? "page" : undefined}
      >
        <Users className="h-4 w-4" />
        Atlete
      </Link>
      <Link
        href="/admin/test-fisici/riepilogo"
        className={tab(active === "riepilogo")}
        aria-current={active === "riepilogo" ? "page" : undefined}
        data-tour="test-fisici-riepilogo"
      >
        <Table2 className="h-4 w-4" />
        Riepilogo
      </Link>
    </nav>
  );
}
