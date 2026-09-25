import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function SchedeLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("schede");
  return children;
}
