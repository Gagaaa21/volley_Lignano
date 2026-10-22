import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

/** Sezione «super riservata»: serve il permesso «Trasferte» (il Developer lo ha sempre) e non esiste per il Minivolley. */
export default async function TrasferteLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("trasferte");
  return children;
}
