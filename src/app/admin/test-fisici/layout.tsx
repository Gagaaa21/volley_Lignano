import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function PhysicalTestsLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("testfisici");
  return children;
}
