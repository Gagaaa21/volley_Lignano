import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function PresenzeLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("presenze");
  return children;
}
