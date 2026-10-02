import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";
import { GemPeek } from "@/components/tour/clash/GemPeek";

export default async function PhysicalTestsLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("testfisici");
  return (
    <>
      {children}
      {/* Easter egg: Gem si nasconde solo nelle pagine di Test fisici. */}
      <GemPeek />
    </>
  );
}
