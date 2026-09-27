import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function PronosticiLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("pronostici");
  return children;
}
