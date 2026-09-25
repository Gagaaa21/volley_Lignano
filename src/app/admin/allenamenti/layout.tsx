import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function AllenamentiLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("allenamenti");
  return children;
}
