import type { ReactNode } from "react";

import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileAppNav } from "@/components/layout/mobile-app-nav";
import { getCurrentViewer } from "@/services/auth";

export default async function CivicAppLayout({ children }: { children: ReactNode }) {
  const viewer = await getCurrentViewer();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#eef3f8] text-slate-950 dark:bg-[#0a0f1a] dark:text-slate-100">
      <AppTopbar viewer={viewer} />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <MobileAppNav viewer={viewer} />
    </div>
  );
}
