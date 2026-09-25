import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function GuidaLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("guida");
  return children;
}
